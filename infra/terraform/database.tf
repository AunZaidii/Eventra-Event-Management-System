# Managed PostgreSQL (Amazon RDS) in the private DB subnets. Not publicly accessible,
# encrypted at rest, SSL forced in transit, reachable only from the app security group.

resource "random_password" "db" {
  length           = 32
  special          = true
  override_special = "!#$%^&*()-_=+[]{}<>:?" # RDS does not allow / @ " or spaces
}

resource "aws_db_subnet_group" "main" {
  name        = "${local.name}-db-subnets"
  description = "Private DB subnets in two AZs"
  subnet_ids  = aws_subnet.private_db[*].id
}

resource "aws_db_parameter_group" "postgres" {
  name   = "${local.name}-postgres16"
  family = "postgres16"

  parameter {
    name         = "rds.force_ssl"
    value        = "1"              # reject any unencrypted connection
    apply_method = "pending-reboot" # how AWS reports this static parameter (avoids a diff on every plan)
  }
}

resource "aws_db_instance" "main" {
  identifier     = "${local.name}-db"
  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  allocated_storage     = 20
  max_allocated_storage = 50 # storage grows automatically if needed
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "eventra"
  username = "eventra_admin"
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  parameter_group_name   = aws_db_parameter_group.postgres.name
  publicly_accessible    = false
  multi_az               = var.db_multi_az

  backup_retention_period         = 1
  backup_window                   = "03:00-03:30"
  maintenance_window              = "sun:04:00-sun:04:30"
  auto_minor_version_upgrade      = true
  enabled_cloudwatch_logs_exports = ["postgresql"]
  copy_tags_to_snapshot           = true

  # Coursework settings: allow a clean `terraform destroy`.
  skip_final_snapshot = true
  deletion_protection = false
  apply_immediately   = true

  tags = { Name = "${local.name}-db", Tier = "db" }
}
