# StokCerdas Staging Environment Configuration

# General Configuration
environment = "staging"
aws_region  = "ap-southeast-1"

# Network Configuration
vpc_cidr = "10.1.0.0/16"

# Database Configuration
db_instance_class       = "db.t3.small"
backup_retention_period = 7
backup_window          = "03:00-04:00"
maintenance_window     = "sun:04:00-sun:05:00"

# Redis Configuration
redis_node_type = "cache.t3.small"

# ECS Configuration
ecs_desired_capacity = 2
ecs_min_capacity    = 1
ecs_max_capacity    = 5

# Application Configuration
app_image  = "stokcerdas/api:staging"
app_cpu    = 512
app_memory = 1024

# Feature Flags
enable_monitoring        = true
enable_backup           = true
enable_ssl              = true
enable_spot_instances   = false
enable_scheduled_scaling = false
enable_waf              = true
enable_shield           = false
enable_cloudtrail       = true
enable_config           = false
enable_guardduty        = false
enable_cloudfront       = true
enable_debug_mode       = false

# Multi-tenancy
enable_tenant_isolation = true
max_tenants_per_instance = 500

# Security
allowed_cidr_blocks = ["0.0.0.0/0"]

# Domain Configuration
domain_name = "staging.stokcerdas.com"

# Indonesian Optimization
indonesian_region_optimization = true