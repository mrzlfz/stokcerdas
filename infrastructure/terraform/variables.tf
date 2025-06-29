# StokCerdas Infrastructure - Variables

# General Configuration
variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "stokcerdas"
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
  
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be one of: dev, staging, production."
  }
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "ap-southeast-1"
}

# Network Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

# Database Configuration
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "stokcerdas"
}

variable "db_username" {
  description = "Database username"
  type        = string
  default     = "stokcerdas"
}

variable "backup_retention_period" {
  description = "Backup retention period in days"
  type        = number
  default     = 7
}

variable "backup_window" {
  description = "Backup window"
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Maintenance window"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

# Redis Configuration
variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

# ECS Configuration
variable "ecs_desired_capacity" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 2
}

variable "ecs_min_capacity" {
  description = "Minimum number of ECS tasks"
  type        = number
  default     = 1
}

variable "ecs_max_capacity" {
  description = "Maximum number of ECS tasks"
  type        = number
  default     = 10
}

# Application Configuration
variable "app_image" {
  description = "Docker image for the application"
  type        = string
  default     = "stokcerdas/api:latest"
}

variable "app_port" {
  description = "Port the application runs on"
  type        = number
  default     = 3000
}

variable "app_cpu" {
  description = "CPU units for the application"
  type        = number
  default     = 256
}

variable "app_memory" {
  description = "Memory for the application"
  type        = number
  default     = 512
}

# Domain Configuration
variable "domain_name" {
  description = "Domain name for the application (optional)"
  type        = string
  default     = ""
}

# Feature Flags
variable "enable_monitoring" {
  description = "Enable CloudWatch monitoring and alarms"
  type        = bool
  default     = true
}

variable "enable_backup" {
  description = "Enable automatic backups"
  type        = bool
  default     = true
}

variable "enable_ssl" {
  description = "Enable SSL certificate"
  type        = bool
  default     = true
}

# Cost Optimization
variable "enable_spot_instances" {
  description = "Use spot instances for cost optimization"
  type        = bool
  default     = false
}

variable "enable_scheduled_scaling" {
  description = "Enable scheduled scaling for predictable workloads"
  type        = bool
  default     = false
}

# Security Configuration
variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access the application"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "enable_waf" {
  description = "Enable AWS WAF for additional security"
  type        = bool
  default     = false
}

variable "enable_shield" {
  description = "Enable AWS Shield for DDoS protection"
  type        = bool
  default     = false
}

# Compliance Configuration
variable "enable_cloudtrail" {
  description = "Enable CloudTrail for audit logging"
  type        = bool
  default     = true
}

variable "enable_config" {
  description = "Enable AWS Config for compliance monitoring"
  type        = bool
  default     = false
}

variable "enable_guardduty" {
  description = "Enable GuardDuty for threat detection"
  type        = bool
  default     = false
}

# Indonesian Specific Configuration
variable "indonesian_region_optimization" {
  description = "Optimize for Indonesian users (Jakarta region)"
  type        = bool
  default     = true
}

variable "enable_cloudfront" {
  description = "Enable CloudFront CDN for better performance in Indonesia"
  type        = bool
  default     = true
}

# Multi-tenancy Configuration
variable "enable_tenant_isolation" {
  description = "Enable tenant isolation features"
  type        = bool
  default     = true
}

variable "max_tenants_per_instance" {
  description = "Maximum number of tenants per instance"
  type        = number
  default     = 1000
}

# Notification Configuration
variable "sns_topic_arn" {
  description = "SNS topic ARN for notifications"
  type        = string
  default     = ""
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications"
  type        = string
  default     = ""
  sensitive   = true
}

# Development Configuration
variable "enable_debug_mode" {
  description = "Enable debug mode (only for dev environment)"
  type        = bool
  default     = false
}