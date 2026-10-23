output "website_url" {
  description = "Open this in a browser once the pipeline has deployed the images"
  value       = "http://${aws_lb.main.dns_name}"
}

output "admin_email" {
  value = var.admin_email
}

output "admin_password_command" {
  description = "Run this to see the generated admin password"
  value       = "aws secretsmanager get-secret-value --secret-id ${aws_secretsmanager_secret.app.name} --query SecretString --output text --region ${var.aws_region}"
}

output "github_actions_secret" {
  description = "Add as a repository SECRET (Settings > Secrets and variables > Actions > Secrets)"
  value       = { AWS_ROLE_ARN = aws_iam_role.github_deploy.arn }
}

output "github_actions_variables" {
  description = "Add each as a repository VARIABLE (Settings > Secrets and variables > Actions > Variables)"
  value = {
    AWS_DEPLOY_ENABLED = "true"
    AWS_REGION         = var.aws_region
    ECR_REPO_APP       = aws_ecr_repository.this["app"].name
    ECR_REPO_WEB       = aws_ecr_repository.this["web"].name
    ECS_CLUSTER        = aws_ecs_cluster.main.name
    ECS_SERVICE_APP    = aws_ecs_service.app.name
    ECS_SERVICE_WEB    = aws_ecs_service.web.name
  }
}

output "ecr_repository_urls" {
  value = { for k, r in aws_ecr_repository.this : k => r.repository_url }
}

output "rds_endpoint" {
  description = "Private DNS name of the database (only reachable from the app tier)"
  value       = aws_db_instance.main.address
}

output "vpc_id" {
  value = aws_vpc.main.id
}

output "cloudwatch_dashboard_url" {
  value = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards/dashboard/${aws_cloudwatch_dashboard.main.dashboard_name}"
}
