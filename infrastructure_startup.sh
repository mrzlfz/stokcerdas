#!/bin/bash

echo "🚀 StokCerdas Infrastructure Deployment"
echo "======================================="

# Step 1: Create production environment file
echo "📁 Setting up production environment..."
if [ -f ".env.production" ]; then
    echo "✅ .env.production exists"
    cp .env.production .env
    echo "✅ Production environment file copied to .env"
else
    echo "⚠️ .env.production not found, using .env.development"
    cp .env.development .env
fi

# Step 2: Build and start infrastructure services
echo ""
echo "🐳 Starting infrastructure services..."
echo "Starting PostgreSQL, Redis, and RabbitMQ..."

# Use docker compose (v2) instead of docker-compose
docker compose -f docker-compose.prod.yml up -d postgres redis rabbitmq

# Step 3: Wait for services to be healthy
echo ""
echo "⏳ Waiting for infrastructure services to be healthy..."
sleep 10

# Step 4: Verify service health
echo ""
echo "🔍 Verifying service health..."

# Check PostgreSQL
echo "🐘 Testing PostgreSQL connection..."
timeout 30 bash -c 'until docker compose -f docker-compose.prod.yml exec -T postgres pg_isready -U postgres; do echo "Waiting for PostgreSQL..."; sleep 2; done' && echo "✅ PostgreSQL is ready" || echo "❌ PostgreSQL failed to start"

# Check Redis
echo "🔴 Testing Redis connection..."
timeout 30 bash -c 'until docker compose -f docker-compose.prod.yml exec -T redis redis-cli ping | grep -q PONG; do echo "Waiting for Redis..."; sleep 2; done' && echo "✅ Redis is ready" || echo "❌ Redis failed to start"

# Check RabbitMQ
echo "🐰 Testing RabbitMQ connection..."
timeout 30 bash -c 'until docker compose -f docker-compose.prod.yml exec -T rabbitmq rabbitmq-diagnostics ping | grep -q "Ping succeeded"; do echo "Waiting for RabbitMQ..."; sleep 2; done' && echo "✅ RabbitMQ is ready" || echo "❌ RabbitMQ failed to start"

# Step 5: Show service status
echo ""
echo "📊 Service Status:"
docker compose -f docker-compose.prod.yml ps

echo ""
echo "✅ Infrastructure services deployment complete!"
echo "📋 Next steps: Run database migrations"