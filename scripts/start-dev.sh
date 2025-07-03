#!/bin/bash

# StokCerdas Development Environment Startup Script
# This script automates the complete setup process for local development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="StokCerdas"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to print section header
print_section() {
    echo
    print_status $CYAN "=================================="
    print_status $CYAN "$1"
    print_status $CYAN "=================================="
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for service to be ready
wait_for_service() {
    local service_name=$1
    local check_command=$2
    local max_attempts=${3:-30}
    local attempt=1
    
    print_status $YELLOW "⏳ Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if eval $check_command >/dev/null 2>&1; then
            print_status $GREEN "✅ $service_name is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo
    print_status $RED "❌ $service_name failed to start after $max_attempts attempts"
    return 1
}

# Function to display service URLs
show_urls() {
    print_section "🌐 SERVICE URLS"
    
    cat << EOF
📋 StokCerdas Development Environment URLs:

🎯 Main Application:
   • API Swagger Documentation: http://localhost:3000/api/docs
   • API Health Check:          http://localhost:3000/api/v1/health
   • WebSocket Endpoint:        ws://localhost:3000/realtime

💾 Data Services:
   • MinIO Console (Storage):   http://localhost:9001
     Username: minioadmin | Password: minioadmin123
   • RabbitMQ Management:       http://localhost:15672
     Username: stokcerdas | Password: stokcerdas_queue

🔍 Development Tools:
   • Kibana (Search):           http://localhost:5601
   • MailHog (Email Testing):   http://localhost:8025
   • Jaeger (Tracing):          http://localhost:16686

🔗 Direct Database Connections:
   • PostgreSQL: postgresql://stokcerdas:stokcerdas_password@localhost:5432/stokcerdas_dev
   • Redis:      redis://localhost:6379
   • Elasticsearch: http://localhost:9200
EOF
}

# Main startup function
main() {
    cd "$PROJECT_ROOT"
    
    print_status $PURPLE "🚀 Starting $PROJECT_NAME Development Environment"
    print_status $BLUE "Project Directory: $PROJECT_ROOT"
    echo
    
    # Parse command line arguments
    SKIP_DEPS=false
    SKIP_MIGRATION=false
    SKIP_SEED=false
    VERBOSE=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-deps)
                SKIP_DEPS=true
                shift
                ;;
            --skip-migration)
                SKIP_MIGRATION=true
                shift
                ;;
            --skip-seed)
                SKIP_SEED=true
                shift
                ;;
            --verbose|-v)
                VERBOSE=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --skip-deps        Skip npm install"
                echo "  --skip-migration   Skip database migrations"
                echo "  --skip-seed        Skip database seeding"
                echo "  --verbose, -v      Verbose output"
                echo "  --help, -h         Show this help message"
                exit 0
                ;;
            *)
                print_status $RED "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Step 1: Check prerequisites and ports
    print_section "🔍 CHECKING PREREQUISITES & PORTS"
    
    if [ -f "$SCRIPT_DIR/check-ports.sh" ]; then
        bash "$SCRIPT_DIR/check-ports.sh" --auto-kill
    else
        print_status $YELLOW "⚠️  Port check script not found, continuing..."
    fi
    
    # Step 2: Check environment file
    print_section "⚙️  CHECKING ENVIRONMENT CONFIGURATION"
    
    if [ ! -f ".env.development" ]; then
        print_status $RED "❌ .env.development file not found!"
        print_status $YELLOW "💡 Please create .env.development file first"
        exit 1
    else
        print_status $GREEN "✅ Environment configuration found"
    fi
    
    # Step 3: Start Docker services
    print_section "🐳 STARTING DOCKER SERVICES"
    
    print_status $BLUE "📥 Starting infrastructure services..."
    if [ "$VERBOSE" = "true" ]; then
        docker compose up -d
    else
        docker compose up -d >/dev/null 2>&1
    fi
    
    print_status $GREEN "✅ Docker services started"
    
    # Step 4: Wait for services to be ready
    print_section "⏳ WAITING FOR SERVICES"
    
    wait_for_service "PostgreSQL" "docker exec stokcerdas-postgres pg_isready -U stokcerdas"
    wait_for_service "Redis" "docker exec stokcerdas-redis redis-cli ping"
    wait_for_service "MinIO" "curl -f http://localhost:9000/minio/health/live"
    wait_for_service "RabbitMQ" "curl -f http://localhost:15672"
    wait_for_service "Elasticsearch" "curl -f http://localhost:9200/_cluster/health"
    
    # Step 5: Install dependencies
    if [ "$SKIP_DEPS" = "false" ]; then
        print_section "📦 INSTALLING DEPENDENCIES"
        
        print_status $BLUE "📥 Installing Node.js dependencies..."
        if [ "$VERBOSE" = "true" ]; then
            npm install
        else
            npm install >/dev/null 2>&1
        fi
        print_status $GREEN "✅ Dependencies installed"
    else
        print_status $YELLOW "⏭️  Skipping dependency installation"
    fi
    
    # Step 6: Database migrations
    if [ "$SKIP_MIGRATION" = "false" ]; then
        print_section "🗄️  DATABASE SETUP"
        
        print_status $BLUE "🔧 Running database migrations..."
        if npm run migration:run; then
            print_status $GREEN "✅ Database migrations completed"
        else
            print_status $YELLOW "⚠️  Migration warnings (this might be normal if already run)"
        fi
    else
        print_status $YELLOW "⏭️  Skipping database migrations"
    fi
    
    # Step 7: Seed data
    if [ "$SKIP_SEED" = "false" ]; then
        print_status $BLUE "🌱 Seeding initial data..."
        if npm run seed:run; then
            print_status $GREEN "✅ Database seeding completed"
        else
            print_status $YELLOW "⚠️  Seeding warnings (this might be normal if already run)"
        fi
    else
        print_status $YELLOW "⏭️  Skipping database seeding"
    fi
    
    # Step 8: Final health check
    print_section "🔍 FINAL HEALTH CHECK"
    
    # Wait a moment for everything to settle
    sleep 3
    
    print_status $BLUE "🔍 Checking service status..."
    docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" | head -10
    
    # Step 9: Show URLs and next steps
    show_urls
    
    print_section "🎉 READY TO START DEVELOPMENT"
    
    cat << EOF
✅ StokCerdas development environment is ready!

🚀 To start the API server:
   npm run dev

📱 To start the mobile app:
   cd mobile && npm install && npm start

🔧 Common development commands:
   npm run dev          # Start API in watch mode
   npm run test         # Run unit tests
   npm run test:e2e     # Run end-to-end tests
   npm run lint         # Check code style
   npm run typecheck    # Check TypeScript types

📚 Documentation:
   • Development Guide: docs/DEVELOPMENT_GUIDE.md
   • API Documentation: http://localhost:3000/api/docs (after starting)

🆘 If you encounter issues:
   • Check logs: docker compose logs -f
   • Restart services: docker compose restart
   • Full reset: docker compose down -v && $0

Happy coding! 🇮🇩
EOF

    echo
    print_status $GREEN "🎯 Environment setup completed successfully!"
    
    # Ask if user wants to start the API server
    echo
    read -p "🚀 Start the API server now? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status $BLUE "🚀 Starting StokCerdas API server..."
        npm run dev
    else
        print_status $BLUE "👋 Run 'npm run dev' when you're ready to start the API server"
    fi
}

# Run main function
main "$@"