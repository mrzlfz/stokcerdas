#!/bin/bash

echo "🔍 StokCerdas Environment Variables Verification"
echo "================================================="

# Core Application
check_var() {
    if [ -z "${!1}" ]; then
        echo "❌ $1 is not set"
        MISSING_VARS="$MISSING_VARS $1"
    else
        echo "✅ $1 is set"
    fi
}

MISSING_VARS=""

# Application Configuration
check_var "NODE_ENV"
check_var "PORT"
check_var "APP_URL"

# Database Configuration
check_var "DB_HOST" 
check_var "DB_PORT"
check_var "DB_USERNAME"
check_var "DB_PASSWORD"
check_var "DB_NAME"

# Redis Configuration
check_var "REDIS_HOST"
check_var "REDIS_PORT"

# RabbitMQ Configuration
check_var "RABBITMQ_HOST"
check_var "RABBITMQ_USERNAME"
check_var "RABBITMQ_PASSWORD"

# Indonesian E-commerce Integration
check_var "SHOPEE_PARTNER_ID"
check_var "SHOPEE_PARTNER_KEY"
check_var "LAZADA_APP_KEY"
check_var "LAZADA_APP_SECRET"
check_var "TOKOPEDIA_CLIENT_ID"
check_var "TOKOPEDIA_CLIENT_SECRET"

# Security Configuration
check_var "JWT_SECRET"
check_var "JWT_REFRESH_SECRET"
check_var "ENCRYPTION_KEY"

# Indonesian Payment Gateways
check_var "XENDIT_SECRET_KEY"
check_var "MIDTRANS_SERVER_KEY"

if [ -z "$MISSING_VARS" ]; then
    echo "✅ All critical environment variables verified successfully"
    exit 0
else
    echo "❌ Missing environment variables:$MISSING_VARS"
    echo "📝 Loading from .env.development for development environment"
    exit 1
fi