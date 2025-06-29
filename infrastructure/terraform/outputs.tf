# StokCerdas Infrastructure - Outputs

# VPC Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = module.vpc.private_subnet_ids
}

# Application Load Balancer Outputs
output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = module.ecs.alb_dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer"
  value       = module.ecs.alb_zone_id
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = module.ecs.alb_arn
}

# ECS Outputs
output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = module.ecs.cluster_name
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = module.ecs.cluster_arn
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = module.ecs.service_name
}

output "ecs_service_arn" {
  description = "ARN of the ECS service"
  value       = module.ecs.service_arn
}

output "ecs_task_definition_arn" {
  description = "ARN of the ECS task definition"
  value       = module.ecs.task_definition_arn
}

# Database Outputs
output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = module.rds.db_endpoint
  sensitive   = true
}

output "rds_port" {
  description = "RDS instance port"
  value       = module.rds.db_port
}

output "rds_identifier" {
  description = "RDS instance identifier"
  value       = module.rds.db_identifier
}

output "database_url" {
  description = "Database connection URL"
  value       = module.rds.database_url
  sensitive   = true
}

# Redis Outputs
output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = module.elasticache.redis_endpoint
  sensitive   = true
}

output "redis_port" {
  description = "Redis cluster port"
  value       = module.elasticache.redis_port
}

output "redis_url" {
  description = "Redis connection URL"
  value       = module.elasticache.redis_url
  sensitive   = true
}

# S3 Outputs
output "s3_bucket_name" {
  description = "Name of the S3 bucket"
  value       = module.s3.bucket_name
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = module.s3.bucket_arn
}

output "s3_bucket_domain_name" {
  description = "Domain name of the S3 bucket"
  value       = module.s3.bucket_domain_name
}

# CloudWatch Outputs
output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = module.cloudwatch.log_group_name
}

output "cloudwatch_log_group_arn" {
  description = "ARN of the CloudWatch log group"
  value       = module.cloudwatch.log_group_arn
}

# Security Group Outputs
output "app_security_group_id" {
  description = "ID of the application security group"
  value       = module.security_groups.app_security_group_id
}

output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = module.security_groups.alb_security_group_id
}

output "rds_security_group_id" {
  description = "ID of the RDS security group"
  value       = module.security_groups.rds_security_group_id
}

output "redis_security_group_id" {
  description = "ID of the Redis security group"
  value       = module.security_groups.redis_security_group_id
}

# Route53 Outputs (if domain is configured)
output "domain_name" {
  description = "Domain name for the application"
  value       = var.domain_name != "" ? var.domain_name : null
}

output "route53_zone_id" {
  description = "Route53 hosted zone ID"
  value       = var.domain_name != "" ? module.route53[0].zone_id : null
}

# ACM Outputs (if SSL is configured)
output "acm_certificate_arn" {
  description = "ARN of the ACM certificate"
  value       = var.domain_name != "" ? module.acm[0].certificate_arn : null
}

# Application URLs
output "application_url" {
  description = "URL to access the application"
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "http://${module.ecs.alb_dns_name}"
}

output "api_url" {
  description = "URL to access the API"
  value       = var.domain_name != "" ? "https://${var.domain_name}/api" : "http://${module.ecs.alb_dns_name}/api"
}

output "health_check_url" {
  description = "URL for health checks"
  value       = var.domain_name != "" ? "https://${var.domain_name}/health" : "http://${module.ecs.alb_dns_name}/health"
}

# Environment Information
output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "aws_region" {
  description = "AWS region"
  value       = var.aws_region
}

output "project_name" {
  description = "Project name"
  value       = var.project_name
}

# Resource ARNs for IAM and cross-service access
output "resource_arns" {
  description = "Map of important resource ARNs"
  value = {
    ecs_cluster          = module.ecs.cluster_arn
    ecs_service          = module.ecs.service_arn
    ecs_task_definition  = module.ecs.task_definition_arn
    alb                  = module.ecs.alb_arn
    s3_bucket           = module.s3.bucket_arn
    cloudwatch_log_group = module.cloudwatch.log_group_arn
  }
}

# Cost tracking outputs
output "estimated_monthly_cost" {
  description = "Estimated monthly cost breakdown"
  value = {
    rds           = "Depends on instance class and storage"
    ecs           = "Depends on number of tasks and resources"
    elasticache   = "Depends on node type and number of nodes"
    alb           = "Fixed cost + data processing charges"
    s3            = "Depends on storage and requests"
    cloudwatch    = "Depends on logs and metrics volume"
    data_transfer = "Depends on traffic volume"
  }
}