# StokCerdas Production Environment Configuration

# General Configuration
environment = "production"
aws_region  = "ap-southeast-1"

# Network Configuration
vpc_cidr = "10.2.0.0/16"

# Database Configuration
db_instance_class       = "db.r6g.large"
backup_retention_period = 30
backup_window          = "03:00-04:00"
maintenance_window     = "sun:04:00-sun:05:00"

# Redis Configuration
redis_node_type = "cache.r6g.large"

# ECS Configuration
ecs_desired_capacity = 4
ecs_min_capacity    = 2
ecs_max_capacity    = 20

# Application Configuration
app_image  = "stokcerdas/api:latest"
app_cpu    = 1024
app_memory = 2048

# Feature Flags
enable_monitoring        = true
enable_backup           = true
enable_ssl              = true
enable_spot_instances   = false
enable_scheduled_scaling = true
enable_waf              = true
enable_shield           = true
enable_cloudtrail       = true
enable_config           = true
enable_guardduty        = true
enable_cloudfront       = true
enable_debug_mode       = false

# Multi-tenancy (Production scale)
enable_tenant_isolation = true
max_tenants_per_instance = 1000

# Security (Production hardened)
allowed_cidr_blocks = [
  "0.0.0.0/0"  # Will be restricted to specific IPs in production
]

# Domain Configuration
domain_name = "stokcerdas.com"

# Indonesian Optimization
indonesian_region_optimization = true

# Performance and Scaling
enable_auto_scaling = true
target_cpu_utilization = 70
target_memory_utilization = 80

# High Availability
enable_multi_az = true
enable_cross_region_backup = true

# Compliance and Security
enable_encryption_at_rest = true
enable_encryption_in_transit = true
enable_detailed_monitoring = true
enable_enhanced_monitoring = true

# Cost Optimization
reserved_instance_percentage = 50
enable_cost_anomaly_detection = true

# Disaster Recovery
enable_automated_snapshots = true
snapshot_retention_days = 90
enable_point_in_time_recovery = true

# Monitoring and Alerting
enable_detailed_cloudwatch_metrics = true
enable_custom_metrics = true
enable_log_aggregation = true