# StokCerdas Development Environment Configuration

# General Configuration
environment = "dev"
aws_region  = "ap-southeast-1"

# Network Configuration
vpc_cidr = "10.0.0.0/16"

# Database Configuration
db_instance_class       = "db.t3.micro"
backup_retention_period = 1
backup_window          = "03:00-04:00"
maintenance_window     = "sun:04:00-sun:05:00"

# Redis Configuration
redis_node_type = "cache.t3.micro"

# ECS Configuration
ecs_desired_capacity = 1
ecs_min_capacity    = 1
ecs_max_capacity    = 3

# Application Configuration
app_image  = "stokcerdas/api:develop"
app_cpu    = 256
app_memory = 512

# Feature Flags
enable_monitoring        = true
enable_backup           = false
enable_ssl              = false
enable_spot_instances   = true
enable_scheduled_scaling = false
enable_waf              = false
enable_shield           = false
enable_cloudtrail       = false
enable_config           = false
enable_guardduty        = false
enable_cloudfront       = false
enable_debug_mode       = true

# Cost Optimization (for development)
enable_tenant_isolation = false
max_tenants_per_instance = 100

# Security (relaxed for development)
allowed_cidr_blocks = ["0.0.0.0/0"]

# Domain (empty for development - will use ALB DNS)
domain_name = ""