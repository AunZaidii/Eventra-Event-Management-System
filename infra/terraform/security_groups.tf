# One security group per tier. Each tier accepts traffic ONLY from the tier in front of it:
#
#   Internet --80--> [alb-sg] --80--> [web-sg] --4000--> [app-sg] --5432--> [db-sg]
#
# Groups reference each other (not IP ranges), so the rules stay correct as tasks scale.

resource "aws_security_group" "alb" {
  name        = "${local.name}-alb-sg"
  description = "Load balancer: HTTP from the internet, forwards only to the web tier"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${local.name}-alb-sg", Tier = "public" }
}

resource "aws_security_group" "web" {
  name        = "${local.name}-web-sg"
  description = "Web tier (Nginx): reachable only from the load balancer"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${local.name}-web-sg", Tier = "web" }
}

resource "aws_security_group" "app" {
  name        = "${local.name}-app-sg"
  description = "App tier (Node API): reachable only from the web tier"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${local.name}-app-sg", Tier = "app" }
}

resource "aws_security_group" "db" {
  name        = "${local.name}-db-sg"
  description = "Database tier (RDS): reachable only from the app tier, no outbound rules"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${local.name}-db-sg", Tier = "db" }
}

# ---- Load balancer ----
resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP from anywhere"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "alb_to_web" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Forward requests and health checks to web tasks"
  ip_protocol                  = "tcp"
  from_port                    = 80
  to_port                      = 80
  referenced_security_group_id = aws_security_group.web.id
}

# ---- Web tier ----
resource "aws_vpc_security_group_ingress_rule" "web_from_alb" {
  security_group_id            = aws_security_group.web.id
  description                  = "HTTP from the load balancer only"
  ip_protocol                  = "tcp"
  from_port                    = 80
  to_port                      = 80
  referenced_security_group_id = aws_security_group.alb.id
}

resource "aws_vpc_security_group_egress_rule" "web_to_app" {
  security_group_id            = aws_security_group.web.id
  description                  = "API calls to the app tier (Service Connect)"
  ip_protocol                  = "tcp"
  from_port                    = 4000
  to_port                      = 4000
  referenced_security_group_id = aws_security_group.app.id
}

resource "aws_vpc_security_group_egress_rule" "web_https_out" {
  security_group_id = aws_security_group.web.id
  description       = "HTTPS out via NAT: pull images from ECR, send logs to CloudWatch"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

# ---- App tier ----
resource "aws_vpc_security_group_ingress_rule" "app_from_web" {
  security_group_id            = aws_security_group.app.id
  description                  = "API port from the web tier only"
  ip_protocol                  = "tcp"
  from_port                    = 4000
  to_port                      = 4000
  referenced_security_group_id = aws_security_group.web.id
}

resource "aws_vpc_security_group_egress_rule" "app_to_db" {
  security_group_id            = aws_security_group.app.id
  description                  = "PostgreSQL to the database tier"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.db.id
}

resource "aws_vpc_security_group_egress_rule" "app_https_out" {
  security_group_id = aws_security_group.app.id
  description       = "HTTPS out via NAT: ECR, Secrets Manager, CloudWatch"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

# ---- Database tier ----
resource "aws_vpc_security_group_ingress_rule" "db_from_app" {
  security_group_id            = aws_security_group.db.id
  description                  = "PostgreSQL from the app tier only"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.app.id
}
