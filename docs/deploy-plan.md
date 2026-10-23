# Deploy Plan: Eventra on AWS

This is a step-by-step guide to take Eventra from the repo to a live, load-balanced AWS deployment, collect the evidence, and remove everything afterwards.
**Nothing here has been run yet.** Every step is done by you, in order. Total time is about 1 hour, most of it waiting.

| | |
|---|---|
| **Cloud** | AWS, region `us-east-1` (N. Virginia) |
| **Infrastructure as code** | Terraform in [infra/terraform/](../infra/terraform) |
| **Pipeline** | GitHub Actions [.github/workflows/ci-cd.yml](../.github/workflows/ci-cd.yml) |
| **Estimated cost** | about **$2.20 per day** while running (see [cost-estimate.md](cost-estimate.md)). Destroy it when you're done |

---

## What gets created

```
Internet → ALB (public subnets, 2 AZs) → web tasks: Nginx (private-app subnets)
                                            → Service Connect app.eventra.local:4000
                                              → app tasks: Node API (private-app subnets)
                                                → RDS PostgreSQL (private-db subnets, no internet route)
Private-app subnets → NAT instance (public subnet) → Internet  (image pulls, Secrets Manager, logs)
GitHub Actions --OIDC--> IAM role --> ECR (push) + ECS (deploy)
```

About 60 resources: a VPC, 6 subnets, an Internet Gateway, 3 route tables, a NAT instance, 5 security groups, the ALB with its target group and listener, an ECS cluster with 2 services and auto scaling, RDS PostgreSQL 16, 2 ECR repos, a Secrets Manager secret, IAM roles plus the GitHub OIDC provider, and CloudWatch logs, a dashboard, 4 alarms and an SNS topic.

---

## Step 0: One-time preparation (about 20 min)

1. **Billing safety net:** AWS Console → *Billing and Cost Management* → *Budgets* → **Create budget** → *Use a template* → **Monthly cost budget**, $10, with your email.
2. **Install the tools** (PowerShell), then reopen VS Code:
   ```powershell
   winget install Amazon.AWSCLI
   winget install Hashicorp.Terraform
   aws --version
   terraform -version
   ```
3. **Credentials for your laptop only:**
   - IAM → *Users* → **Create user** `eventra-admin` → *Attach policies directly* → `AdministratorAccess`.
   - Open the user → *Security credentials* → **Create access key** → "Command Line Interface (CLI)".
   - Then run:
     ```powershell
     aws configure            # paste key id + secret, region us-east-1, output json
     aws sts get-caller-identity
     ```
   These keys stay on your laptop. They're never put in GitHub, because the pipeline uses OIDC.

## Step 1: Create the infrastructure (about 15 min, mostly RDS)

```powershell
cd "infra/terraform"
copy terraform.tfvars.example terraform.tfvars    # optional: set alarm_email
terraform init
terraform plan -out tfplan                         # review: ~60 resources to add, 0 to destroy
terraform apply tfplan
```
- If the apply fails with *"Provider with url https://token.actions.githubusercontent.com already exists"*, your account already has the GitHub OIDC provider. Set `create_github_oidc_provider = false` in `terraform.tfvars` and run `terraform apply` again.
- The ECS services are created before any image exists in ECR, so their first tasks fail with *"CannotPullContainerError"*. **That's expected.** Step 3 pushes the images and fixes it.

Save the outputs:
```powershell
terraform output
```

## Step 2: Connect GitHub to AWS (about 5 min)

GitHub repo → **Settings** → **Secrets and variables** → **Actions**:

- **Secrets** tab → *New repository secret*:
  - `AWS_ROLE_ARN` = the value of `github_actions_secret.AWS_ROLE_ARN`. It's an IAM role ARN, not a password.
- **Variables** tab → *New repository variable* for each entry of `github_actions_variables`:

| Name | Value |
|---|---|
| `AWS_DEPLOY_ENABLED` | `true` |
| `AWS_REGION` | `us-east-1` |
| `ECR_REPO_APP` | `eventra-app` |
| `ECR_REPO_WEB` | `eventra-web` |
| `ECS_CLUSTER` | `eventra` |
| `ECS_SERVICE_APP` | `eventra-app` |
| `ECS_SERVICE_WEB` | `eventra-web` |

## Step 3: First deployment (about 10 min)

GitHub → **Actions** → **CI/CD** → **Run workflow** → branch `main` → **Run workflow**.

The run does the following:
1. Tests the backend.
2. Lints and builds the frontend.
3. Validates the Terraform code.
4. Builds both Docker images.
5. Deploys:
   - logs in to AWS with OIDC
   - pushes the images to ECR, tagged with the commit SHA and `latest`
   - registers new task definition revisions and rolls out the `app` and then the `web` service
   - waits until both are stable, then runs a smoke test on `/api/health` through the ALB

From now on, **every push to `main` repeats this automatically.**

## Step 4: Open the site

```powershell
terraform output website_url                       # http://eventra-alb-XXXX.us-east-1.elb.amazonaws.com
terraform output -raw admin_password_command       # copy and run the printed command
```
The admin email is `admin@eventra.app` (unless you changed it). The password is the `ADMIN_PASSWORD` value in the printed JSON.

## Step 5: AWS console and GitHub screenshots (about 20 min)

Follow [evidence-checklist.md](evidence-checklist.md): 29 screenshots, with exact pages and file names, saved into `docs/evidence/screenshots/`.

## Step 6: Automatic evidence (about 3 min)

From the project root (Git Bash or the VS Code terminal):
```bash
bash infra/collect-evidence.sh                     # CLI proof → docs/evidence/cli/
```

## Step 7: App screenshots on the live site (about 3 min)

```bash
cd tests/e2e && npm install
export BASE_URL="$(cd ../../infra/terraform && terraform output -raw website_url)"
export ADMIN_EMAIL=admin@eventra.app
export ADMIN_PASSWORD='<password from step 4>'
node ui-test.js ../../docs/evidence/app            # 29 browser checks + screenshots
```

## Step 8: Optional demos for the report

- **Load balancing / statelessness:** in ECS → `eventra-web` → *Update service*, set desired tasks to 2. Refresh the target group: 2 healthy targets in 2 AZs.
- **Elasticity:** generate load (for example with `npx autocannon -c 50 -d 120 $BASE_URL/api/events`) and watch the service scale out in ECS *Events* and on the CloudWatch dashboard.
- **Self-healing:** ECS → *Tasks* → stop a task. ECS starts a replacement automatically.

## Step 9: Build the report

```bash
cd docs/report && npm install && node build-report.js   # → docs/report/Eventra-Technical-Report.docx
```
Your screenshots are inserted automatically. Any missing ones show as a labelled placeholder.

## Step 10: Tear down (important, stops all charges)

```powershell
cd infra/terraform
terraform destroy                                   # type "yes", about 10 min
```
Then on GitHub, set the variable `AWS_DEPLOY_ENABLED` to `false`, so pushes don't try to deploy to the deleted environment.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `terraform apply`: *EntityAlreadyExists … OIDC provider* | Set `create_github_oidc_provider = false` and apply again |
| Deploy job: *Not authorized to perform sts:AssumeRoleWithWebIdentity* | `AWS_ROLE_ARN` secret is wrong, or the run isn't on `main` |
| Web tasks keep restarting with *host not found in upstream "app.eventra.local"* | The app service wasn't healthy yet. Wait for it, then ECS → `eventra-web` → *Update service* → **Force new deployment** |
| App logs: *no pg_hba.conf entry … no encryption* | `DB_SSL` must be `true` (it is set in the task definition) |
| Target group shows *unhealthy* | Check the `web` logs in CloudWatch `/ecs/eventra`. The health check path is `/healthz` |
| Site loads but API calls fail (502) | Check the `app` service is *Running* and its logs show "Eventra API listening" |

## Known limitations (also in the report)

- **One NAT instance** in one AZ (cost choice). If it fails, private tasks lose *outbound* internet; incoming traffic keeps working. Production fix: a NAT Gateway per AZ.
- **Single-AZ RDS** (`db_multi_az = false`). Production fix: `db_multi_az = true`.
- **HTTP only.** HTTPS needs a domain and an ACM certificate: add a 443 listener and redirect 80 → 443.
- **Minimum of 1 task per tier.** Set `min_tasks = 2` for a task in each AZ at all times.
- RDS TLS is enforced, but the API doesn't pin the RDS CA certificate yet.
