variable "project" {
  description = "Name prefix for every resource"
  type        = string
  default     = "eventra"
}

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "github_repository" {
  description = "GitHub repo (owner/name) allowed to deploy through OIDC"
  type        = string
  default     = "AunZaidii/Eventra-Event-Management-System"
}

variable "create_github_oidc_provider" {
  description = "Create the GitHub OIDC identity provider. Set false if your AWS account already has one."
  type        = bool
  default     = true
}

# ---------------- Network ----------------

variable "vpc_cidr" {
  description = "Address range of the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "nat_instance_type" {
  description = "Size of the NAT instance (cheap replacement for a NAT Gateway)"
  type        = string
  default     = "t4g.nano"
}

# ---------------- Application ----------------

variable "admin_email" {
  description = "Email for the Eventra admin login (the password is generated and stored in Secrets Manager)"
  type        = string
  default     = "admin@eventra.app"
}

variable "image_tag" {
  description = "Image tag used when Terraform first creates the task definitions (CI/CD deploys commit SHAs afterwards)"
  type        = string
  default     = "latest"
}

variable "seed_sample_data" {
  description = "Load the sample events on first start"
  type        = bool
  default     = true
}

variable "web_cpu" {
  description = "Fargate CPU units for one web task (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

variable "web_memory" {
  description = "Fargate memory (MiB) for one web task"
  type        = number
  default     = 512
}

variable "app_cpu" {
  description = "Fargate CPU units for one app task"
  type        = number
  default     = 256
}

variable "app_memory" {
  description = "Fargate memory (MiB) for one app task"
  type        = number
  default     = 512
}

# ---------------- Scaling ----------------

variable "min_tasks" {
  description = "Minimum running tasks per service (2 = one per AZ for higher availability)"
  type        = number
  default     = 1
}

variable "max_tasks" {
  description = "Maximum tasks per service that auto scaling may start"
  type        = number
  default     = 3
}

variable "cpu_target_percent" {
  description = "Average CPU % that auto scaling tries to keep"
  type        = number
  default     = 60
}

variable "spot_weight" {
  description = "Share of extra (scaled-out) tasks placed on cheaper FARGATE_SPOT. 0 = all on regular Fargate."
  type        = number
  default     = 1
}

# ---------------- Database ----------------

variable "db_instance_class" {
  description = "RDS instance size"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_engine_version" {
  description = "PostgreSQL major version"
  type        = string
  default     = "16"
}

variable "db_multi_az" {
  description = "Run a standby database in a second AZ (automatic failover, doubles the DB cost)"
  type        = bool
  default     = false
}

# ---------------- Monitoring ----------------

variable "log_retention_days" {
  description = "How long CloudWatch keeps container logs"
  type        = number
  default     = 7
}

variable "container_insights" {
  description = "Enable ECS Container Insights (extra CloudWatch metrics, small extra cost)"
  type        = bool
  default     = false
}

variable "alarm_email" {
  description = "Email that receives CloudWatch alarm notifications (empty = no subscription)"
  type        = string
  default     = ""
}
