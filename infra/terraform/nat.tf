# NAT instance: a t4g.micro that forwards outbound traffic from the private app subnets.
# Cost optimization: ~$6/month instead of ~$33/month for a managed NAT Gateway.
# Trade-off (documented in the report): it is a single instance in one AZ, so it is
# not highly available. Swap for aws_nat_gateway in production.

data "aws_ssm_parameter" "al2023_arm64" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

resource "aws_security_group" "nat" {
  name        = "${local.name}-nat-sg"
  description = "NAT instance: accepts traffic only from inside the VPC"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${local.name}-nat-sg" }
}

resource "aws_vpc_security_group_ingress_rule" "nat_from_vpc" {
  security_group_id = aws_security_group.nat.id
  description       = "Any traffic from inside the VPC (to be forwarded to the internet)"
  ip_protocol       = "-1"
  cidr_ipv4         = var.vpc_cidr
}

resource "aws_vpc_security_group_egress_rule" "nat_to_internet" {
  security_group_id = aws_security_group.nat.id
  description       = "Forward outbound traffic to the internet"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_instance" "nat" {
  ami                         = data.aws_ssm_parameter.al2023_arm64.value
  instance_type               = var.nat_instance_type
  subnet_id                   = aws_subnet.public[0].id
  vpc_security_group_ids      = [aws_security_group.nat.id]
  associate_public_ip_address = true
  source_dest_check           = false # required so it can forward other machines' traffic

  # No SSH key and no open SSH port: nothing to log in to.
  metadata_options {
    http_tokens = "required" # IMDSv2 only
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = 8
    encrypted   = true
  }

  user_data_replace_on_change = true
  user_data                   = <<-EOT
    #!/bin/bash
    set -euxo pipefail
    dnf install -y iptables-services
    systemctl enable --now iptables
    echo "net.ipv4.ip_forward = 1" > /etc/sysctl.d/90-nat.conf
    sysctl --system
    IFACE=$(ip route show default | awk '{print $5}' | head -n1)
    iptables -F
    iptables -P INPUT ACCEPT
    iptables -P FORWARD ACCEPT
    iptables -P OUTPUT ACCEPT
    iptables -t nat -F
    iptables -t nat -A POSTROUTING -o "$IFACE" -s ${var.vpc_cidr} -j MASQUERADE
    iptables-save > /etc/sysconfig/iptables
  EOT

  tags = { Name = "${local.name}-nat-instance" }
}
