# Deployment Evidence Checklist (SE-490 CEA, deliverable 2)

Take these after the pipeline has deployed successfully (see [deploy-plan.md](deploy-plan.md), step 6).
Save each screenshot in **`docs/evidence/screenshots/`** with the **exact file name** shown. The report generator (`docs/report/build-report.js`) picks them up automatically and puts each one in the right section with a caption.

**Tips**
- Region selector (top right of the console) must show **N. Virginia (us-east-1)**.
- Use `Win + Shift + S` → *Rectangle* to capture just the page area, then save it as PNG.
- Make the browser window wide (about 1400px or more), so tables show all columns.
- Never capture secret values, access keys or the Secrets Manager **Retrieve secret value** panel.

| # | File name | Where to go in the AWS Console / GitHub | What must be visible |
|---|---|---|---|
| 1 | `01-vpc.png` | **VPC** → *Your VPCs* → select `eventra-vpc` | Name, VPC ID, **IPv4 CIDR 10.0.0.0/16**, State *Available* |
| 2 | `02-subnets.png` | **VPC** → *Subnets* → filter by VPC `eventra-vpc` | All **6 subnets**: `public-*`, `private-app-*`, `private-db-*`, their CIDRs and **two different AZs** |
| 3 | `03-route-tables.png` | **VPC** → *Route tables* → select `eventra-rt-public` → *Routes* tab | `0.0.0.0/0 → igw-…` (Internet Gateway) |
| 4 | `04-route-table-private.png` | Same page → select `eventra-rt-private-app` → *Routes* tab | `0.0.0.0/0 → eni-…` (the NAT instance). Optional extra: `eventra-rt-private-db` showing only the `local` route |
| 5 | `05-internet-gateway.png` | **VPC** → *Internet gateways* | `eventra-igw`, State *Attached*, VPC `eventra-vpc` |
| 6 | `06-nat-instance.png` | **EC2** → *Instances* → `eventra-nat-instance` | Running, type **t4g.nano**, public IPv4, public subnet |
| 7 | `07-ecs-cluster.png` | **ECS** → *Clusters* → `eventra` → *Services* tab | `eventra-web` and `eventra-app`, status *Active*, tasks **Running = Desired** |
| 8 | `08-ecs-tasks.png` | **ECS** → `eventra` → *Tasks* tab | Running tasks, *Healthy*, launch type/capacity provider **FARGATE** |
| 9 | `09-ecs-service-connect.png` | **ECS** → `eventra` → `eventra-app` → *Configuration and networking* (scroll to **Service Connect**) | Discovery name `app`, endpoint `app.eventra.local:4000`, private subnets, `assign public IP: Off` |
| 10 | `10-autoscaling.png` | **ECS** → `eventra` → `eventra-web` → *Configuration and networking* → **Service auto scaling** (or *Update service* → Service auto scaling) | Min **1** / Max **3**, target-tracking policies (CPU 60%, ALB requests per target) |
| 11 | `11-sg-alb.png` | **EC2** → *Security Groups* → `eventra-alb-sg` → *Inbound rules* | HTTP 80 from `0.0.0.0/0` |
| 12 | `12-sg-web.png` | `eventra-web-sg` → *Inbound rules* | HTTP 80 **from `eventra-alb-sg`** only |
| 13 | `13-sg-app.png` | `eventra-app-sg` → *Inbound rules* | TCP 4000 **from `eventra-web-sg`** only |
| 14 | `14-sg-db.png` | `eventra-db-sg` → *Inbound rules* (and *Outbound rules*: none) | TCP 5432 **from `eventra-app-sg`** only |
| 15 | `15-load-balancer.png` | **EC2** → *Load Balancers* → `eventra-alb` (*Details* + *Listeners and rules*) | Scheme **internet-facing**, 2 AZs, listener **HTTP:80 → eventra-web-tg** |
| 16 | `16-target-group.png` | **EC2** → *Target Groups* → `eventra-web-tg` → *Targets* tab | Registered task IPs with status **healthy**, health check path `/healthz` |
| 17 | `17-rds.png` | **RDS** → *Databases* → `eventra-db` → *Connectivity & security* | Engine PostgreSQL 16, status *Available*, **Publicly accessible: No**, subnet group `eventra-db-subnets`, security group `eventra-db-sg` |
| 18 | `18-rds-config.png` | Same database → *Configuration* tab | Instance class `db.t4g.micro`, **Encryption: Enabled** |
| 19 | `19-ecr-repos.png` | **ECR** → *Private repositories* | `eventra-web` and `eventra-app`, *Scan on push: Enabled* |
| 20 | `20-ecr-images.png` | **ECR** → `eventra-web` (then `eventra-app`) → *Images* | Image tags = **commit SHA** + `latest`, pushed time, size |
| 21 | `21-secrets-manager.png` | **Secrets Manager** → *Secrets* | `eventra/app` listed (**do not** open "Retrieve secret value") |
| 22 | `22-iam-oidc.png` | **IAM** → *Roles* → `eventra-github-deploy` → *Trust relationships* | Federated `token.actions.githubusercontent.com`, condition limited to `repo:AunZaidii/Event-Management-System` |
| 23 | `23-cloudwatch-dashboard.png` | **CloudWatch** → *Dashboards* → `eventra-overview` | Graphs with data (open the site a few times first) |
| 24 | `24-cloudwatch-alarms.png` | **CloudWatch** → *Alarms* → *All alarms* | The 4 `eventra-*` alarms (state *OK*) |
| 25 | `25-cloudwatch-logs.png` | **CloudWatch** → *Log groups* → `/ecs/eventra` → a `app/app/…` stream | API startup lines: "Applied migration…", "Eventra API listening…" |
| 26 | `26-github-actions-run.png` | **GitHub** → repo → *Actions* → latest run on `main` | All jobs green **including "Deploy to AWS"** |
| 27 | `27-github-deploy-log.png` | Same run → *Deploy to AWS* job → expand **Build and push images** and **Smoke test** | `docker push …` lines to ECR, health check `{"status":"ok","db":"up"}` |
| 28 | `28-app-in-browser.png` | Your browser → the `website_url` from `terraform output` | Eventra homepage with the **ALB address visible in the address bar** |
| 29 | `29-pricing-calculator.png` | <https://calculator.aws> → *Create estimate* (inputs in [cost-estimate.md](cost-estimate.md)) | The estimate summary with the monthly total. Also copy the **share link** into `docs/evidence/pricing-link.txt` |

## Captured automatically (no clicking needed)

| What | Command (run from the project root) | Output |
|---|---|---|
| CLI proof of every component | `bash infra/collect-evidence.sh` | `docs/evidence/cli/*.txt` |
| App screenshots on desktop and phone (home, event, confirmation, admin dashboard, events, registrations) | see [deploy-plan.md](deploy-plan.md) step 7 | `docs/evidence/app/*.png` |
| Terraform apply output | `terraform apply ... \| tee ../../docs/evidence/cli/terraform-apply.txt` | `docs/evidence/cli/terraform-apply.txt` |
| Docker image build (local) | `docker compose build 2>&1 \| tee docs/evidence/cli/docker-build.txt` | `docs/evidence/cli/docker-build.txt` |

When everything is in place, rebuild the report: `cd docs/report && npm install && node build-report.js`.
