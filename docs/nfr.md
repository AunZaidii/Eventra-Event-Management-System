# Non-Functional Requirements Justification

Each attribute below lists the **design decisions** that support it (with where they live in the repo), the **evidence**, and the **known limitations**, each with an improvement.

## 1. Scalability
**Decisions**
- **Stateless app containers:** no server sessions and no local files. Admin auth is a signed JWT, and all state is in PostgreSQL ([backend/src/middleware/auth.js](../backend/src/middleware/auth.js)). Any task can serve any request.
- **Horizontal scaling** of both tiers on ECS Fargate, behind an ALB that spreads requests over a target group of task IPs ([infra/terraform/ecs.tf](../infra/terraform/ecs.tf), [load_balancer.tf](../infra/terraform/load_balancer.tf)).
- **Safe concurrency at the data layer:** registrations lock the event row (`SELECT … FOR UPDATE`) and rely on a unique `(event_id, email)` constraint. Many app copies can't overbook or create duplicates.
- **Migrations use a Postgres advisory lock**, so several new tasks can start at the same time safely.
- **Pagination** on every list endpoint, plus indexes on `starts_at`, `category` and `event_id`.

**Evidence:** locally, 2 app containers served one JWT session 20/20 times (test report, cloud-readiness). The concurrency test with 10 parallel registrations for 3 seats gave exactly 3 successes.

**Limitations:** a single RDS instance is the vertical bottleneck. *Improvement:* RDS read replicas or Aurora Serverless v2, plus connection pooling with RDS Proxy.

## 2. Availability / Reliability
**Decisions**
- **Two Availability Zones:** public, app and DB subnets in each AZ, and an ALB across both AZs. ECS can place tasks in either AZ.
- **Health checks at every level:**
  - ALB target health on `/healthz`
  - container health checks
  - `/api/health` checks the database and returns 503 if it's down
  - ECS replaces unhealthy tasks automatically (self-healing)
- **Deployment circuit breaker with automatic rollback:** a bad release never replaces a healthy one.
- **Managed database:** automated backups, automatic minor-version patches, storage auto-scaling.
- **Graceful shutdown** (`SIGTERM` → finish requests → close DB pool) and ALB deregistration delay, for zero-downtime rolling deploys.

**Limitations (cost-driven choices)**
- `min_tasks = 1`: during a task replacement a tier briefly has one task, and an AZ outage could take that task down. *Fix:* `min_tasks = 2`.
- Single-AZ RDS. *Fix:* `db_multi_az = true` gives automatic failover to a standby.
- One NAT instance is a single point of failure for **outbound** traffic only (image pulls, Secrets Manager, logs). Incoming user traffic is unaffected. *Fix:* a managed NAT Gateway per AZ, or VPC endpoints.

## 3. Elasticity
**Decisions**
- **Application Auto Scaling target tracking** on both services (min 1, max 3):
  - average **CPU 60%** (web and app)
  - **ALB requests per target = 500/min** (web)
- Scale-out cooldown is 60 s; scale-in cooldown is 180 s. Capacity grows quickly under load and shrinks automatically when idle, so it's not statically provisioned.
- **Fargate:** no servers to pre-provision. Each new task gets exactly 0.25 vCPU and 0.5 GB.
- **RDS storage autoscaling** from 20 to 50 GB.

**Evidence:** scaling targets and policies (`docs/evidence/cli/13-autoscaling.txt`, screenshot 10). The load test in deploy-plan step 8 shows scale-out.

**Limitations:** the database compute doesn't scale automatically. *Improvement:* Aurora Serverless v2.

## 4. Security
**Network**
- **Segmentation:** only the ALB and the NAT instance are in public subnets. Web and app tasks run in private subnets with **no public IPs**. RDS is in separate private DB subnets whose route table has **no internet route at all**, and `publicly_accessible = false`.
- **Least-privilege security groups, chained by group ID:** Internet → `alb-sg:80` → `web-sg:80` → `app-sg:4000` → `db-sg:5432`. The app tier accepts traffic **only from the web tier**, and the DB **only from the app tier**. The DB security group has no outbound rules ([security_groups.tf](../infra/terraform/security_groups.tf)).

**Data**
- RDS storage is encrypted, and `rds.force_ssl = 1` makes TLS mandatory for every connection.
- Passwords are hashed with bcrypt (cost 12).
- All SQL is parameterised.
- CSV exports neutralise spreadsheet formulas.

**Secrets**
- No secret is in the code, the images or Git. `.env` is git-ignored.
- On AWS, Terraform generates random DB, JWT and admin passwords and stores them in **Secrets Manager**. ECS injects them at start-up.
- The execution role can read **only** that one secret.

**CI/CD**
- GitHub Actions authenticates with **OIDC**: there are **no long-lived AWS keys** in GitHub.
- The deploy role trusts only `repo:AunZaidii/Event-Management-System` on `main` / the `production` environment.
- It can push only to the two ECR repos, update only the two ECS services, and pass only the two ECS roles.
- The workflow's default token is read-only.

**Application**
- helmet headers and a strict CSP in Nginx
- a CORS allow-list
- rate limits (login 10 per 15 min, registration 20 per 10 min per IP)
- Zod validation on every endpoint
- JWT expiry (8 h)
- containers run as a non-root user
- ECR scans every image on push
- the NAT instance uses IMDSv2 and has no SSH

**Limitations**
- HTTP only. *Fix:* an ACM certificate and an HTTPS listener with a redirect. Optionally AWS WAF on the ALB.
- The RDS CA isn't pinned (TLS is enforced but the certificate isn't verified).
- Rate-limit counters are per task. *Fix:* a shared Redis store.

## 5. Maintainability / Deployability
**Decisions**
- **Containers:** the same images run locally (`docker compose up`), in CI and on ECS, so environments don't drift.
- **CI/CD on every push:**
  - test (78 backend tests against a real Postgres)
  - lint and build
  - `terraform validate`
  - Docker build
  - push to ECR, tagged with the **commit SHA** (traceable and immutable)
  - rolling ECS deploy, wait for stability, smoke test
- **Infrastructure as code:** the whole environment is `terraform apply`, so it's reviewable, repeatable and removable with `terraform destroy`.
- Clean code layout (routes, controllers, services, middleware, db), migrations, central error handling, README and docs.
- Rollback options: automatic (circuit breaker), or redeploy a previous SHA tag.

**Limitations:** no separate staging environment. *Improvement:* a Terraform workspace per environment and a manual approval rule on the `production` environment.

## 6. Performance / Latency
**Decisions**
- Nginx serves the static React build with gzip and **1-year immutable caching** for hashed assets. `index.html` is never cached.
- Admin pages are code-split and loaded on demand, so the public bundle stays small (≈ 78 kB gzipped).
- The API uses a connection pool. Seats left are calculated in one SQL query with indexes, and lists are paginated.
- All tiers are in **one region and one VPC**, so tier-to-tier hops are sub-millisecond private networking. Service Connect gives direct task-to-task routing.
- Auto scaling adds capacity before response times degrade. The CloudWatch dashboard tracks p50/p95 `TargetResponseTime`.

**Limitations:** no CDN and no application cache. *Improvement:* CloudFront in front of the ALB (or S3 + CloudFront for static files), and Redis/ElastiCache for hot event lists.

## 7. Cost-Efficiency
**Decisions** ([cost-estimate.md](cost-estimate.md))
- ≈ **$65/month** compared with ≈ $127 for the standard HA layout.
- NAT instance instead of a NAT Gateway (–$30/month).
- Smallest Fargate size, with a minimum of 1 task and auto scaling.
- FARGATE_SPOT for scaled-out tasks.
- Graviton t4g for the NAT and RDS.
- 7-day log retention and ECR lifecycle rules.
- One command to destroy everything (≈ $2.20/day while running).

**Limitations:** this saving is exactly what reduces availability (§2). The trade-off is a conscious choice for a coursework system, and switching to the HA setup takes two variable changes.

## 8. Portability
**Decisions**
- The app is packaged as standard **OCI Docker images** with no AWS SDK dependency in the code.
- All configuration comes from **environment variables** (12-factor), and the database is standard PostgreSQL.
- The same `docker-compose.yml` runs the full stack on any machine.
- Moving to Azure (Container Apps + Azure Database for PostgreSQL), GCP (Cloud Run + Cloud SQL) or Kubernetes changes only the infrastructure layer (Terraform) and the pipeline's deploy job, not the application.
- Nginx's backend address is a single variable (`BACKEND_URL`).

**Limitations:** the Terraform code and the deploy job are AWS-specific. *Improvement:* Kubernetes manifests or Helm (EKS/AKS/GKE) for a provider-neutral deployment target.

## Summary

| NFR | Main supporting decisions | Status |
|---|---|---|
| Scalability | stateless containers, ALB + target group, row locks | ✅ |
| Availability | 2 AZs, health checks, self-healing, circuit breaker | 🟡 (single NAT, single-AZ DB, min 1 task, by choice) |
| Elasticity | target-tracking auto scaling on CPU and requests, Fargate | ✅ |
| Security | segmented subnets, chained security groups, Secrets Manager, OIDC, TLS to DB | 🟡 (HTTP only) |
| Maintainability | containers, CI/CD with tests, IaC, SHA-tagged images | ✅ |
| Performance | caching headers, code splitting, indexes, same-region tiers | 🟡 (no CDN or cache) |
| Cost-efficiency | NAT instance, Spot, right-sizing, lifecycle rules, destroy | ✅ |
| Portability | Docker, env-var config, standard PostgreSQL | ✅ (IaC is AWS-specific) |
