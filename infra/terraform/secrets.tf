# All runtime secrets live in one Secrets Manager secret. ECS injects each key into the
# app container as an environment variable at start-up; nothing secret is in the image,
# the task definition or the Git repository.
#
# Note: Terraform state also contains these generated values, which is why
# terraform.tfstate is git-ignored and must stay private.

resource "random_password" "jwt" {
  length  = 64
  special = false
}

resource "random_password" "admin" {
  length           = 20
  special          = true
  override_special = "!#%*-_=+"
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${local.name}/app"
  description             = "Eventra API runtime secrets (database, JWT, admin login)"
  recovery_window_in_days = 0 # delete immediately on destroy so the name can be reused
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    DB_HOST        = aws_db_instance.main.address
    DB_NAME        = aws_db_instance.main.db_name
    DB_USER        = aws_db_instance.main.username
    DB_PASSWORD    = random_password.db.result
    JWT_SECRET     = random_password.jwt.result
    ADMIN_EMAIL    = var.admin_email
    ADMIN_PASSWORD = random_password.admin.result
  })
}

locals {
  app_secret_keys = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD", "JWT_SECRET", "ADMIN_EMAIL", "ADMIN_PASSWORD"]
}
