#!/usr/bin/env bash
# Saves AWS CLI proof of every deployed component to docs/evidence/cli/*.txt
# (backup evidence for the report, next to the console screenshots).
#
# Usage (from the project root, after `terraform apply` and a successful deploy):
#   bash infra/collect-evidence.sh
# Needs: AWS CLI v2 configured for the account, and terraform (for the outputs).
set -uo pipefail
cd "$(dirname "$0")/.."

PROJECT="${PROJECT:-eventra}"
REGION="${AWS_REGION:-$(aws configure get region)}"
REGION="${REGION:-us-east-1}"
OUT="docs/evidence/cli"
mkdir -p "$OUT"
export AWS_PAGER=""
aws_() { aws --region "$REGION" "$@"; }

save() { # save <file> <title> <command...>
  local file="$OUT/$1"; local title="$2"; shift 2
  { echo "# $title"; echo "# \$ $*"; echo "# captured $(date -u +%Y-%m-%dT%H:%M:%SZ)"; echo; "$@" 2>&1; } > "$file"
  echo "saved $file"
}

VPC_ID=$(aws_ ec2 describe-vpcs --filters "Name=tag:Name,Values=${PROJECT}-vpc" --query 'Vpcs[0].VpcId' --output text)
ALB_ARN=$(aws_ elbv2 describe-load-balancers --names "${PROJECT}-alb" --query 'LoadBalancers[0].LoadBalancerArn' --output text)
TG_ARN=$(aws_ elbv2 describe-target-groups --names "${PROJECT}-web-tg" --query 'TargetGroups[0].TargetGroupArn' --output text)
ALB_DNS=$(aws_ elbv2 describe-load-balancers --names "${PROJECT}-alb" --query 'LoadBalancers[0].DNSName' --output text)

save 00-identity.txt "Account and region" aws_ sts get-caller-identity
save 01-vpc.txt "VPC" aws_ ec2 describe-vpcs --vpc-ids "$VPC_ID" \
  --query 'Vpcs[].{VpcId:VpcId,Cidr:CidrBlock,Name:Tags[?Key==`Name`]|[0].Value}' --output table
save 02-subnets.txt "Subnets (public / private-app / private-db in two AZs)" aws_ ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'sort_by(Subnets,&CidrBlock)[].{Name:Tags[?Key==`Name`]|[0].Value,Cidr:CidrBlock,AZ:AvailabilityZone,PublicIP:MapPublicIpOnLaunch}' --output table
save 03-route-tables.txt "Route tables and routes" aws_ ec2 describe-route-tables --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'RouteTables[].{Name:Tags[?Key==`Name`]|[0].Value,Routes:Routes[].[DestinationCidrBlock,GatewayId||NetworkInterfaceId||`local`]}' --output yaml
save 04-internet-gateway.txt "Internet Gateway" aws_ ec2 describe-internet-gateways --filters "Name=attachment.vpc-id,Values=$VPC_ID" --output table
save 05-nat-instance.txt "NAT instance (cost-optimised NAT)" aws_ ec2 describe-instances \
  --filters "Name=tag:Name,Values=${PROJECT}-nat-instance" "Name=instance-state-name,Values=running" \
  --query 'Reservations[].Instances[].{Id:InstanceId,Type:InstanceType,State:State.Name,PublicIp:PublicIpAddress,SourceDestCheck:SourceDestCheck,Subnet:SubnetId}' --output table
save 06-security-groups.txt "Security groups and rules per tier" aws_ ec2 describe-security-group-rules \
  --filters "Name=group-id,Values=$(aws_ ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" "Name=group-name,Values=${PROJECT}-*" --query 'SecurityGroups[].GroupId' --output text | tr '\t' ',')" \
  --query 'sort_by(SecurityGroupRules,&GroupId)[].{Group:GroupId,Egress:IsEgress,Proto:IpProtocol,From:FromPort,To:ToPort,Cidr:CidrIpv4,FromGroup:ReferencedGroupInfo.GroupId,Description:Description}' --output table
save 07-security-group-names.txt "Security group IDs and names" aws_ ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'SecurityGroups[].{Id:GroupId,Name:GroupName,Description:Description}' --output table
save 08-load-balancer.txt "Application Load Balancer" aws_ elbv2 describe-load-balancers --load-balancer-arns "$ALB_ARN" \
  --query 'LoadBalancers[].{Name:LoadBalancerName,DNS:DNSName,Scheme:Scheme,State:State.Code,AZs:AvailabilityZones[].ZoneName}' --output yaml
save 09-listeners.txt "Load balancer listeners" aws_ elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" \
  --query 'Listeners[].{Port:Port,Protocol:Protocol,Action:DefaultActions[0].Type}' --output table
save 10-target-health.txt "Target group health (web tasks)" aws_ elbv2 describe-target-health --target-group-arn "$TG_ARN" \
  --query 'TargetHealthDescriptions[].{TaskIp:Target.Id,Port:Target.Port,AZ:Target.AvailabilityZone,Health:TargetHealth.State}' --output table
save 11-ecs-services.txt "ECS services" aws_ ecs describe-services --cluster "$PROJECT" --services "${PROJECT}-web" "${PROJECT}-app" \
  --query 'services[].{Service:serviceName,Status:status,Desired:desiredCount,Running:runningCount,TaskDef:taskDefinition,Launch:capacityProviderStrategy[].capacityProvider}' --output yaml
save 12-ecs-tasks.txt "Running ECS tasks" bash -c "aws --region $REGION ecs describe-tasks --cluster $PROJECT --tasks \$(aws --region $REGION ecs list-tasks --cluster $PROJECT --query 'taskArns' --output text) \
  --query 'tasks[].{Group:group,Status:lastStatus,Health:healthStatus,AZ:availabilityZone,CapacityProvider:capacityProvider,Image:containers[0].image}' --output yaml"
save 13-autoscaling.txt "ECS auto scaling targets and policies" bash -c "aws --region $REGION application-autoscaling describe-scalable-targets --service-namespace ecs \
  --query 'ScalableTargets[].{Resource:ResourceId,Min:MinCapacity,Max:MaxCapacity}' --output table; \
  aws --region $REGION application-autoscaling describe-scaling-policies --service-namespace ecs \
  --query 'ScalingPolicies[].{Policy:PolicyName,Type:PolicyType,Target:TargetTrackingScalingPolicyConfiguration.TargetValue,Metric:TargetTrackingScalingPolicyConfiguration.PredefinedMetricSpecification.PredefinedMetricType}' --output table"
save 14-rds.txt "RDS PostgreSQL instance" aws_ rds describe-db-instances --db-instance-identifier "${PROJECT}-db" \
  --query 'DBInstances[].{Id:DBInstanceIdentifier,Engine:Engine,Version:EngineVersion,Class:DBInstanceClass,Status:DBInstanceStatus,PubliclyAccessible:PubliclyAccessible,MultiAZ:MultiAZ,Encrypted:StorageEncrypted,SubnetGroup:DBSubnetGroup.DBSubnetGroupName,SecurityGroups:VpcSecurityGroups[].VpcSecurityGroupId}' --output yaml
save 15-ecr-repositories.txt "ECR repositories" aws_ ecr describe-repositories --repository-names "${PROJECT}-web" "${PROJECT}-app" \
  --query 'repositories[].{Name:repositoryName,Uri:repositoryUri,ScanOnPush:imageScanningConfiguration.scanOnPush}' --output table
save 16-ecr-images.txt "ECR images (pushed by the pipeline)" bash -c "for r in ${PROJECT}-web ${PROJECT}-app; do echo \"== \$r\"; aws --region $REGION ecr describe-images --repository-name \$r \
  --query 'reverse(sort_by(imageDetails,&imagePushedAt))[].{Tags:join(\`,\`,imageTags||[\`-\`]),Pushed:imagePushedAt,SizeMB:to_string(imageSizeInBytes)}' --output table; done"
save 17-secrets.txt "Secrets Manager (names only, never values)" aws_ secretsmanager list-secrets \
  --filters "Key=name,Values=${PROJECT}/" --query 'SecretList[].{Name:Name,LastChanged:LastChangedDate}' --output table
save 18-iam-deploy-role.txt "GitHub OIDC deploy role trust policy" aws_ iam get-role --role-name "${PROJECT}-github-deploy" \
  --query 'Role.AssumeRolePolicyDocument' --output json
save 19-cloudwatch.txt "CloudWatch alarms and log group" bash -c "aws --region $REGION cloudwatch describe-alarms --alarm-name-prefix $PROJECT \
  --query 'MetricAlarms[].{Alarm:AlarmName,State:StateValue,Metric:MetricName}' --output table; \
  aws --region $REGION logs describe-log-groups --log-group-name-prefix /ecs/$PROJECT --query 'logGroups[].{Name:logGroupName,RetentionDays:retentionInDays}' --output table"
save 20-health-check.txt "Live health check through the load balancer" curl -sS -i "http://$ALB_DNS/api/health"
save 21-db-not-public.txt "Proof: database endpoint is private (resolves to a 10.x address, no public access)" bash -c \
  "aws --region $REGION rds describe-db-instances --db-instance-identifier ${PROJECT}-db --query 'DBInstances[0].[Endpoint.Address,PubliclyAccessible]' --output text"

echo
echo "Website: http://$ALB_DNS"
echo "Done. Files are in $OUT/"
