# StokCerdas Terraform Infrastructure

This directory contains the Terraform configuration for deploying StokCerdas infrastructure on AWS. The infrastructure is designed to support a multi-tenant SaaS application with high availability, security, and scalability.

## 🏗️ Architecture Overview

The infrastructure includes:

- **VPC** with public and private subnets across multiple AZs
- **Application Load Balancer** for high availability and SSL termination
- **ECS Fargate** for containerized application deployment
- **RDS PostgreSQL** for primary database with automated backups
- **ElastiCache Redis** for caching and session storage
- **S3** for object storage (uploads, backups, static assets)
- **CloudWatch** for monitoring, logging, and alerting
- **Route53** for DNS management (optional)
- **ACM** for SSL certificate management (optional)

## 📁 Directory Structure

```
infrastructure/terraform/
├── main.tf                 # Main Terraform configuration
├── variables.tf           # Variable definitions
├── outputs.tf            # Output definitions
├── terraform.tf          # Provider and backend configuration
├── environments/         # Environment-specific configurations
│   ├── dev.tfvars        # Development environment
│   ├── staging.tfvars    # Staging environment
│   └── production.tfvars # Production environment
├── modules/              # Terraform modules
│   ├── vpc/             # VPC and networking
│   ├── security-groups/ # Security group configurations
│   ├── rds/            # Database configuration
│   ├── elasticache/    # Redis configuration
│   ├── ecs/            # Container orchestration
│   ├── s3/             # Object storage
│   ├── cloudwatch/     # Monitoring and logging
│   ├── route53/        # DNS management
│   └── acm/            # SSL certificates
└── README.md           # This file
```

## 🚀 Quick Start

### Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Terraform** v1.0 or higher installed
3. **S3 bucket** for Terraform state storage
4. **DynamoDB table** for state locking

### 1. Setup State Backend

Create an S3 bucket and DynamoDB table for Terraform state:

```bash
# Create S3 bucket for state
aws s3 mb s3://stokcerdas-terraform-state --region ap-southeast-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket stokcerdas-terraform-state \
  --versioning-configuration Status=Enabled

# Create DynamoDB table for locking
aws dynamodb create-table \
  --table-name stokcerdas-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --region ap-southeast-1
```

### 2. Initialize Terraform

```bash
cd infrastructure/terraform
terraform init
```

### 3. Plan and Apply

For development environment:

```bash
# Plan the deployment
terraform plan -var-file="environments/dev.tfvars"

# Apply the configuration
terraform apply -var-file="environments/dev.tfvars"
```

For staging environment:

```bash
terraform plan -var-file="environments/staging.tfvars"
terraform apply -var-file="environments/staging.tfvars"
```

For production environment:

```bash
terraform plan -var-file="environments/production.tfvars"
terraform apply -var-file="environments/production.tfvars"
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file or set environment variables:

```bash
# AWS Configuration
export AWS_REGION=ap-southeast-1
export AWS_PROFILE=stokcerdas

# Terraform Configuration
export TF_VAR_environment=dev
export TF_VAR_domain_name=dev.stokcerdas.com
```

### Custom Domain Setup

To use a custom domain:

1. Purchase a domain through Route53 or transfer existing domain
2. Set `domain_name` variable in your tfvars file
3. Apply Terraform configuration
4. Update DNS settings if using external DNS provider

### SSL Certificate

SSL certificates are automatically provisioned through AWS Certificate Manager when a domain is configured.

## 🏗️ Infrastructure Components

### VPC and Networking

- **VPC**: Isolated network environment
- **Public Subnets**: For load balancers and NAT gateways
- **Private Subnets**: For application and database servers
- **Internet Gateway**: For internet access
- **NAT Gateways**: For outbound internet access from private subnets

### Security Groups

- **ALB Security Group**: HTTP/HTTPS access from internet
- **App Security Group**: Access from ALB only
- **RDS Security Group**: Access from app servers only
- **Redis Security Group**: Access from app servers only

### Application Load Balancer

- **Health Checks**: Automatic health monitoring
- **SSL Termination**: HTTPS encryption
- **Target Groups**: ECS service integration
- **Auto Scaling**: Based on request volume

### ECS Fargate

- **Cluster**: Container orchestration
- **Service**: Application deployment
- **Task Definition**: Container specifications
- **Auto Scaling**: CPU and memory-based scaling

### Database (RDS)

- **Engine**: PostgreSQL 15
- **Multi-AZ**: High availability (production)
- **Automated Backups**: Daily snapshots
- **Encryption**: At rest and in transit
- **Parameter Groups**: Optimized configurations

### Caching (ElastiCache)

- **Engine**: Redis 7
- **Cluster Mode**: Disabled for simplicity
- **Auth Token**: Password protection
- **Encryption**: At rest and in transit

### Object Storage (S3)

- **Versioning**: Enabled for data protection
- **Encryption**: Server-side encryption
- **Lifecycle Policies**: Cost optimization
- **CORS**: Configured for web uploads

### Monitoring (CloudWatch)

- **Log Groups**: Application and system logs
- **Metrics**: Custom application metrics
- **Alarms**: Automated alerting
- **Dashboards**: Performance visualization

## 🔒 Security Best Practices

### Network Security

- All database servers in private subnets
- Security groups with least privilege access
- VPC Flow Logs for network monitoring
- WAF protection for web applications (production)

### Data Protection

- Encryption at rest for all data stores
- Encryption in transit (TLS 1.3)
- Regular automated backups
- Cross-region backup replication (production)

### Access Control

- IAM roles with minimal required permissions
- No hardcoded credentials in configuration
- AWS Secrets Manager for sensitive data
- CloudTrail for audit logging

### Compliance

- SOC 2 Type II ready architecture
- GDPR/UU PDP compliance features
- Regular security scanning
- Automated compliance monitoring

## 💰 Cost Optimization

### Development Environment

- **t3.micro** instances for cost savings
- **Single AZ** deployment
- **Spot instances** when possible
- **Minimal backup retention**

### Production Environment

- **Reserved instances** for predictable workloads
- **Auto Scaling** to match demand
- **S3 Intelligent Tiering** for storage optimization
- **CloudWatch cost anomaly detection**

### Cost Monitoring

```bash
# View estimated costs
terraform plan -var-file="environments/production.tfvars" | grep -i cost

# Monitor actual costs
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```

## 🚀 Deployment Strategies

### Blue-Green Deployment

1. Deploy new version to staging environment
2. Run comprehensive tests
3. Switch traffic using ALB target groups
4. Keep old version for quick rollback

### Rolling Updates

1. Update ECS service with new task definition
2. ECS automatically replaces tasks gradually
3. Health checks ensure availability
4. Automatic rollback on failures

### Canary Deployments

1. Deploy new version to subset of tasks
2. Route small percentage of traffic
3. Monitor metrics and error rates
4. Gradually increase traffic percentage

## 🔍 Monitoring and Troubleshooting

### Health Checks

```bash
# Application health
curl -f https://stokcerdas.com/health

# Database connectivity
aws rds describe-db-instances --db-instance-identifier stokcerdas-prod

# Redis connectivity
aws elasticache describe-cache-clusters --cache-cluster-id stokcerdas-prod-redis
```

### Log Analysis

```bash
# View application logs
aws logs tail /aws/ecs/stokcerdas-prod --follow

# View ALB access logs
aws s3 ls s3://stokcerdas-prod-alb-logs/ --recursive

# View CloudTrail logs
aws logs filter-log-events \
  --log-group-name CloudTrail/stokcerdas-prod \
  --start-time $(date -d '1 hour ago' +%s)000
```

### Performance Monitoring

```bash
# ECS metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=stokcerdas-prod \
  --start-time $(date -d '1 hour ago' --iso-8601) \
  --end-time $(date --iso-8601) \
  --period 300 \
  --statistics Average

# Database metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBInstanceIdentifier,Value=stokcerdas-prod \
  --start-time $(date -d '1 hour ago' --iso-8601) \
  --end-time $(date --iso-8601) \
  --period 300 \
  --statistics Average
```

## 🔄 Maintenance

### Regular Tasks

1. **Security Updates**: Monthly patching schedule
2. **Backup Verification**: Weekly restore tests
3. **Cost Review**: Monthly cost analysis
4. **Performance Tuning**: Quarterly optimization
5. **Disaster Recovery Testing**: Bi-annual full tests

### Backup and Recovery

```bash
# Manual database backup
aws rds create-db-snapshot \
  --db-instance-identifier stokcerdas-prod \
  --db-snapshot-identifier stokcerdas-manual-$(date +%Y%m%d)

# Restore from backup
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier stokcerdas-restore \
  --db-snapshot-identifier stokcerdas-manual-20240101
```

### Scaling Operations

```bash
# Scale ECS service
aws ecs update-service \
  --cluster stokcerdas-prod \
  --service stokcerdas-prod-service \
  --desired-count 6

# Scale database
aws rds modify-db-instance \
  --db-instance-identifier stokcerdas-prod \
  --db-instance-class db.r6g.xlarge \
  --apply-immediately
```

## 🆘 Emergency Procedures

### Incident Response

1. **Immediate Assessment**: Check CloudWatch alarms
2. **Communication**: Notify stakeholders via Slack
3. **Mitigation**: Scale resources or rollback deployment
4. **Investigation**: Analyze logs and metrics
5. **Resolution**: Apply fixes and monitor recovery
6. **Post-Mortem**: Document lessons learned

### Rollback Procedures

```bash
# Rollback ECS deployment
aws ecs update-service \
  --cluster stokcerdas-prod \
  --service stokcerdas-prod-service \
  --task-definition stokcerdas-prod:PREVIOUS_REVISION

# Rollback database
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier stokcerdas-prod \
  --db-snapshot-identifier stokcerdas-pre-update-snapshot
```

## 📞 Support

For infrastructure support:

- **Documentation**: Check this README and module documentation
- **AWS Support**: Use AWS Support Center for AWS-specific issues
- **Internal Issues**: Create issue in project repository
- **Emergency**: Follow incident response procedures

## 📝 License

This infrastructure code is proprietary to StokCerdas and is not licensed for external use.