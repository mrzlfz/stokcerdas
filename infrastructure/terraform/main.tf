# StokCerdas Infrastructure - Main Configuration

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }

  # Backend configuration for state management
  backend "s3" {
    bucket         = "stokcerdas-terraform-state"
    key            = "infrastructure/terraform.tfstate"
    region         = "ap-southeast-1"
    encrypt        = true
    dynamodb_table = "stokcerdas-terraform-locks"
  }
}

# AWS Provider Configuration
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "StokCerdas"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = "StokCerdas Team"
    }
  }
}

# Random password for database
resource "random_password" "db_password" {
  length  = 32
  special = true
}

# Random password for Redis
resource "random_password" "redis_password" {
  length  = 32
  special = false
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# Local values
locals {
  name_prefix = "${var.project_name}-${var.environment}"
  
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }

  azs = slice(data.aws_availability_zones.available.names, 0, 2)
}

# VPC Module
module "vpc" {
  source = "./modules/vpc"
  
  name_prefix         = local.name_prefix
  vpc_cidr           = var.vpc_cidr
  availability_zones = local.azs
  
  tags = local.common_tags
}

# Security Groups Module
module "security_groups" {
  source = "./modules/security-groups"
  
  name_prefix = local.name_prefix
  vpc_id      = module.vpc.vpc_id
  
  tags = local.common_tags
}

# RDS Module
module "rds" {
  source = "./modules/rds"
  
  name_prefix           = local.name_prefix
  vpc_id               = module.vpc.vpc_id
  private_subnet_ids   = module.vpc.private_subnet_ids
  security_group_ids   = [module.security_groups.rds_security_group_id]
  
  db_instance_class    = var.db_instance_class
  db_name             = var.db_name
  db_username         = var.db_username
  db_password         = random_password.db_password.result
  
  backup_retention_period = var.backup_retention_period
  backup_window          = var.backup_window
  maintenance_window     = var.maintenance_window
  
  tags = local.common_tags
}

# ElastiCache Module
module "elasticache" {
  source = "./modules/elasticache"
  
  name_prefix         = local.name_prefix
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  security_group_ids = [module.security_groups.redis_security_group_id]
  
  node_type     = var.redis_node_type
  auth_token    = random_password.redis_password.result
  
  tags = local.common_tags
}

# ECS Module
module "ecs" {
  source = "./modules/ecs"
  
  name_prefix           = local.name_prefix
  vpc_id               = module.vpc.vpc_id
  private_subnet_ids   = module.vpc.private_subnet_ids
  public_subnet_ids    = module.vpc.public_subnet_ids
  security_group_ids   = [module.security_groups.app_security_group_id]
  alb_security_group_id = module.security_groups.alb_security_group_id
  
  desired_capacity = var.ecs_desired_capacity
  max_capacity    = var.ecs_max_capacity
  min_capacity    = var.ecs_min_capacity
  
  # Application configuration
  app_image    = var.app_image
  app_port     = var.app_port
  cpu_units    = var.app_cpu
  memory_units = var.app_memory
  
  # Environment variables
  database_url = module.rds.database_url
  redis_url    = module.elasticache.redis_url
  
  tags = local.common_tags
}

# S3 Module
module "s3" {
  source = "./modules/s3"
  
  name_prefix = local.name_prefix
  environment = var.environment
  
  tags = local.common_tags
}

# CloudWatch Module
module "cloudwatch" {
  source = "./modules/cloudwatch"
  
  name_prefix = local.name_prefix
  
  # ECS resources
  ecs_cluster_name = module.ecs.cluster_name
  ecs_service_name = module.ecs.service_name
  
  # RDS resources
  rds_identifier = module.rds.db_identifier
  
  # ElastiCache resources
  redis_cluster_id = module.elasticache.cluster_id
  
  # ALB resources
  alb_arn_suffix = module.ecs.alb_arn_suffix
  target_group_arn_suffix = module.ecs.target_group_arn_suffix
  
  tags = local.common_tags
}

# Route53 Module (Optional - for custom domain)
module "route53" {
  source = "./modules/route53"
  count  = var.domain_name != "" ? 1 : 0
  
  domain_name = var.domain_name
  alb_dns_name = module.ecs.alb_dns_name
  alb_zone_id  = module.ecs.alb_zone_id
  
  tags = local.common_tags
}

# ACM Module (Optional - for SSL certificates)
module "acm" {
  source = "./modules/acm"
  count  = var.domain_name != "" ? 1 : 0
  
  domain_name = var.domain_name
  zone_id     = var.domain_name != "" ? module.route53[0].zone_id : ""
  
  tags = local.common_tags
}