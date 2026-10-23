# ECS Fargate: serverless containers for the web and app tiers, in the private app subnets.
# The web tier reaches the app tier through ECS Service Connect at
# http://app.<project>.local:4000 — a name that exists only inside this cluster.

resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${local.name}"
  retention_in_days = var.log_retention_days
}

resource "aws_service_discovery_http_namespace" "main" {
  name        = "${local.name}.local"
  description = "Private service names for Eventra (ECS Service Connect)"
}

resource "aws_ecs_cluster" "main" {
  name = local.name

  setting {
    name  = "containerInsights"
    value = var.container_insights ? "enabled" : "disabled"
  }

  service_connect_defaults {
    namespace = aws_service_discovery_http_namespace.main.arn
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    base              = 1
    weight            = 1
  }
}

locals {
  app_dns_name = "app.${local.name}.local"

  # The first task of each service always runs on regular Fargate (base = 1);
  # extra tasks added by auto scaling are split with cheaper FARGATE_SPOT.
  capacity_strategy = concat(
    [{ provider = "FARGATE", base = 1, weight = 1 }],
    var.spot_weight > 0 ? [{ provider = "FARGATE_SPOT", base = 0, weight = var.spot_weight }] : [],
  )

  log_options = {
    "awslogs-group"  = aws_cloudwatch_log_group.ecs.name
    "awslogs-region" = var.aws_region
  }
}

# ---------------- App tier (Node.js API) ----------------

resource "aws_ecs_task_definition" "app" {
  family                   = "${local.name}-app"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.app_cpu
  memory                   = var.app_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name      = "app"
    image     = "${aws_ecr_repository.this["app"].repository_url}:${var.image_tag}"
    essential = true

    portMappings = [{
      name          = "api" # used by Service Connect
      containerPort = 4000
      protocol      = "tcp"
      appProtocol   = "http"
    }]

    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = "4000" },
      { name = "DB_PORT", value = "5432" },
      { name = "DB_SSL", value = "true" },
      { name = "JWT_EXPIRES_IN", value = "8h" },
      { name = "SEED_SAMPLE_DATA", value = tostring(var.seed_sample_data) },
    ]

    # Injected from Secrets Manager at start-up (never stored in the task definition).
    secrets = [for key in local.app_secret_keys : {
      name      = key
      valueFrom = "${aws_secretsmanager_secret.app.arn}:${key}::"
    }]

    healthCheck = {
      command     = ["CMD-SHELL", "wget -qO- http://127.0.0.1:4000/api/health > /dev/null || exit 1"]
      interval    = 15
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }

    logConfiguration = {
      logDriver = "awslogs"
      options   = merge(local.log_options, { "awslogs-stream-prefix" = "app" })
    }
  }])
}

resource "aws_ecs_service" "app" {
  name                    = "${local.name}-app"
  cluster                 = aws_ecs_cluster.main.id
  task_definition         = aws_ecs_task_definition.app.arn
  desired_count           = var.min_tasks
  enable_ecs_managed_tags = true
  propagate_tags          = "SERVICE"

  dynamic "capacity_provider_strategy" {
    for_each = local.capacity_strategy
    content {
      capacity_provider = capacity_provider_strategy.value.provider
      base              = capacity_provider_strategy.value.base
      weight            = capacity_provider_strategy.value.weight
    }
  }

  network_configuration {
    subnets          = aws_subnet.private_app[*].id
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = false
  }

  # Roll back automatically if a new version never becomes healthy.
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  # Publishes this service as http://app.<project>.local:4000 inside the cluster.
  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_http_namespace.main.arn

    service {
      port_name      = "api"
      discovery_name = "app"
      client_alias {
        port     = 4000
        dns_name = local.app_dns_name
      }
    }

    log_configuration {
      log_driver = "awslogs"
      options    = merge(local.log_options, { "awslogs-stream-prefix" = "app-proxy" })
    }
  }

  # CI/CD deploys new task definition revisions and auto scaling changes the count;
  # Terraform must not undo either.
  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  depends_on = [aws_ecs_cluster_capacity_providers.main, aws_secretsmanager_secret_version.app]
}

# ---------------- Web tier (Nginx + React) ----------------

resource "aws_ecs_task_definition" "web" {
  family                   = "${local.name}-web"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.web_cpu
  memory                   = var.web_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name      = "web"
    image     = "${aws_ecr_repository.this["web"].repository_url}:${var.image_tag}"
    essential = true

    portMappings = [{
      name          = "http"
      containerPort = 80
      protocol      = "tcp"
      appProtocol   = "http"
    }]

    environment = [
      { name = "BACKEND_URL", value = "http://${local.app_dns_name}:4000" },
    ]

    healthCheck = {
      command     = ["CMD-SHELL", "wget -qO- http://127.0.0.1/healthz > /dev/null || exit 1"]
      interval    = 15
      timeout     = 5
      retries     = 3
      startPeriod = 15
    }

    logConfiguration = {
      logDriver = "awslogs"
      options   = merge(local.log_options, { "awslogs-stream-prefix" = "web" })
    }
  }])
}

resource "aws_ecs_service" "web" {
  name                              = "${local.name}-web"
  cluster                           = aws_ecs_cluster.main.id
  task_definition                   = aws_ecs_task_definition.web.arn
  desired_count                     = var.min_tasks
  health_check_grace_period_seconds = 60
  enable_ecs_managed_tags           = true
  propagate_tags                    = "SERVICE"

  dynamic "capacity_provider_strategy" {
    for_each = local.capacity_strategy
    content {
      capacity_provider = capacity_provider_strategy.value.provider
      base              = capacity_provider_strategy.value.base
      weight            = capacity_provider_strategy.value.weight
    }
  }

  network_configuration {
    subnets          = aws_subnet.private_app[*].id
    security_groups  = [aws_security_group.web.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 80
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  # Client-only Service Connect: lets Nginx resolve app.<project>.local.
  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_http_namespace.main.arn
  }

  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  # The app must be registered in Service Connect before Nginx starts and resolves it.
  depends_on = [aws_ecs_service.app, aws_lb_listener.http]
}

# ---------------- Auto scaling (elasticity) ----------------

resource "aws_appautoscaling_target" "service" {
  for_each           = { app = aws_ecs_service.app.name, web = aws_ecs_service.web.name }
  service_namespace  = "ecs"
  scalable_dimension = "ecs:service:DesiredCount"
  resource_id        = "service/${aws_ecs_cluster.main.name}/${each.value}"
  min_capacity       = var.min_tasks
  max_capacity       = var.max_tasks
}

# Target tracking: add tasks when average CPU rises above the target, remove them when it falls.
resource "aws_appautoscaling_policy" "cpu" {
  for_each           = aws_appautoscaling_target.service
  name               = "${local.name}-${each.key}-cpu-target"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = each.value.service_namespace
  scalable_dimension = each.value.scalable_dimension
  resource_id        = each.value.resource_id

  target_tracking_scaling_policy_configuration {
    target_value       = var.cpu_target_percent
    scale_out_cooldown = 60
    scale_in_cooldown  = 180

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

# Web tier also scales on traffic: more than 500 requests per task per minute adds a task.
resource "aws_appautoscaling_policy" "web_requests" {
  name               = "${local.name}-web-requests-target"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.service["web"].service_namespace
  scalable_dimension = aws_appautoscaling_target.service["web"].scalable_dimension
  resource_id        = aws_appautoscaling_target.service["web"].resource_id

  target_tracking_scaling_policy_configuration {
    target_value       = 500
    scale_out_cooldown = 60
    scale_in_cooldown  = 180

    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = "${aws_lb.main.arn_suffix}/${aws_lb_target_group.web.arn_suffix}"
    }
  }
}
