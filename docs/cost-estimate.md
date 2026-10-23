# Monthly Cost Estimate: Eventra on AWS (us-east-1)

On-demand list prices for us-east-1 (N. Virginia), 730 hours a month, low coursework traffic (well under 100 GB of data transfer out, which is free).
**Confirm the numbers with the AWS Pricing Calculator** (<https://calculator.aws>) using the inputs in §3, and screenshot the result (evidence item 29). Prices change over time, and new accounts may also have Free Tier credits.

## 1. Deployed configuration (cost-optimized, what Terraform creates)

| Service | Configuration | Unit price | Monthly |
|---|---|---|---|
| Application Load Balancer | 1 ALB, ~1 LCU | $0.0225/h + $0.008/LCU-h | $16.43 + ~$1.00 |
| ECS Fargate (web) | 1 task × 0.25 vCPU / 0.5 GB, 24×7 | $0.04048/vCPU-h + $0.004445/GB-h | $9.01 |
| ECS Fargate (app) | 1 task × 0.25 vCPU / 0.5 GB, 24×7 | same | $9.01 |
| NAT instance | EC2 t4g.nano + 8 GB gp3 | $0.0042/h + $0.08/GB-mo | $3.07 + $0.64 |
| Public IPv4 addresses | 1 for the NAT instance + 2 for the ALB (one per AZ) | $0.005/h each | $10.95 |
| RDS PostgreSQL | db.t4g.micro, Single-AZ, 20 GB gp3 | $0.016/h + $0.115/GB-mo | $11.68 + $2.30 |
| Secrets Manager | 1 secret | $0.40/secret | $0.40 |
| CloudWatch | ~0.3 GB logs, 4 alarms, 1 dashboard (first 3 free) | $0.50/GB, $0.10/alarm | $0.55 |
| Cloud Map (Service Connect) | ~2 registered instances | $0.10/instance | $0.20 |
| ECR | ~0.5 GB of images (lifecycle keeps 10 per repo) | $0.10/GB-mo | $0.05 |
| SNS, IAM, VPC, route tables, security groups | | free | $0.00 |
| **Total** | | | **≈ $65 / month (≈ $2.20 / day)** |

A 2-day run for screenshots costs about **$4.50**.

## 2. Comparison: the "standard" highly-available setup

| Change from §1 | Monthly |
|---|---|
| NAT Gateway instead of the NAT instance ($0.045/h + $0.045/GB) | +$29.8 |
| 2 tasks per tier (one in each AZ) | +$18.0 |
| Multi-AZ RDS (standby replica) | +$14.0 |
| **Total of the standard setup** | **≈ $127 / month** |

The deployed design costs **about half** of the standard one. §5 of the report explains what availability is given up for that.

## 3. Inputs for the AWS Pricing Calculator

Create estimate → Region **US East (N. Virginia)** → add these services:

1. **Elastic Load Balancing**: Application Load Balancer, 1 load balancer, processed bytes 1 GB/month, ~5 new connections/second.
2. **AWS Fargate**: Linux x86, 2 tasks, 730 h, 0.25 vCPU, 0.5 GB memory, 20 GB ephemeral storage.
3. **Amazon EC2**: 1 × t4g.nano Linux, on-demand, 730 h, EBS gp3 8 GB.
4. **Amazon VPC** → *Public IPv4 addresses*: 3 in-use addresses.
5. **Amazon RDS for PostgreSQL**: 1 × db.t4g.micro, Single-AZ, on-demand, 20 GB gp3, backup 20 GB.
6. **AWS Secrets Manager**: 1 secret, 10,000 API calls.
7. **Amazon CloudWatch**: 0.3 GB logs ingested, 4 standard alarms.
8. **Amazon ECR**: 0.5 GB storage.

Save and share the estimate. Put the link in `docs/evidence/pricing-link.txt`.

## 4. Cost optimizations

**Already implemented:**

| # | Optimization | Saving |
|---|---|---|
| 1 | **NAT instance (t4g.nano) instead of a managed NAT Gateway** | ~$30/month (≈ 45% of the bill) |
| 2 | **Right-sized, elastic compute:** 0.25 vCPU / 0.5 GB tasks, minimum 1 per tier, target-tracking auto scaling up to 3 and back down when idle (scale-in after 3 min) | You pay for extra tasks only while load needs them |
| 3 | **FARGATE_SPOT for scaled-out tasks:** the first task runs on regular Fargate, and extra tasks are split with Spot | Up to ~70% off on burst capacity |
| 4 | **Short log retention (7 days) and ECR lifecycle (10 images per repo)** | Storage stays flat instead of growing forever |
| 5 | **Graviton (ARM) for the NAT instance and RDS** (t4g / db.t4g) | ~20% cheaper than x86 equivalents |
| 6 | **Infrastructure as code with `terraform destroy`** | Environments run only when needed: ~$2.20/day instead of ~$65/month |

**Proposed next steps:**

| # | Optimization | Expected saving |
|---|---|---|
| 7 | Build multi-arch images and run Fargate tasks on **ARM64 (Graviton)** | ~20% of Fargate cost |
| 8 | **Scheduled scaling:** 0 tasks overnight for a demo or staging environment | Up to ~50% of Fargate cost |
| 9 | **Compute Savings Plan / RDS Reserved Instance** (1 year) for a long-running production system | ~30–40% on compute and DB |
| 10 | Serve the React static files from **S3 + CloudFront** instead of Fargate | Removes the web tasks; CDN caching also improves latency |
