#!/bin/bash

# StokCerdas Port Conflict Checker and Resolver
# This script checks for port conflicts and optionally stops conflicting processes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# StokCerdas required ports
declare -A PORTS=(
    ["3000"]="StokCerdas API"
    ["5432"]="PostgreSQL Database"
    ["6379"]="Redis Cache"
    ["9000"]="MinIO Storage"
    ["9001"]="MinIO Console"
    ["5672"]="RabbitMQ AMQP"
    ["15672"]="RabbitMQ Management"
    ["9200"]="Elasticsearch"
    ["9300"]="Elasticsearch Transport"
    ["5601"]="Kibana Dashboard"
    ["1025"]="MailHog SMTP"
    ["8025"]="MailHog Web UI"
    ["16686"]="Jaeger Tracing"
)

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check if a port is in use
check_port() {
    local port=$1
    if command -v lsof >/dev/null 2>&1; then
        lsof -ti:$port 2>/dev/null
    elif command -v netstat >/dev/null 2>&1; then
        netstat -tlnp 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d/ -f1
    else
        print_status $RED "❌ Neither lsof nor netstat found. Cannot check ports."
        return 1
    fi
}

# Function to get process info
get_process_info() {
    local pid=$1
    if command -v ps >/dev/null 2>&1; then
        ps -p $pid -o comm= 2>/dev/null || echo "unknown"
    else
        echo "unknown"
    fi
}

# Function to kill process
kill_process() {
    local pid=$1
    local port=$2
    local service=$3
    
    if [ ! -z "$pid" ]; then
        local process_name=$(get_process_info $pid)
        print_status $YELLOW "⚠️  Port $port ($service) is used by PID $pid ($process_name)"
        
        if [ "$AUTO_KILL" = "true" ]; then
            print_status $BLUE "🔪 Killing process $pid..."
            if kill -9 $pid 2>/dev/null; then
                print_status $GREEN "✅ Successfully killed process on port $port"
            else
                print_status $RED "❌ Failed to kill process $pid. You may need sudo privileges."
                return 1
            fi
        else
            read -p "Kill this process? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                print_status $BLUE "🔪 Killing process $pid..."
                if kill -9 $pid 2>/dev/null; then
                    print_status $GREEN "✅ Successfully killed process on port $port"
                else
                    print_status $RED "❌ Failed to kill process $pid. You may need sudo privileges."
                    return 1
                fi
            else
                print_status $YELLOW "⏭️  Skipping port $port"
            fi
        fi
    fi
}

# Function to check Docker
check_docker() {
    print_status $BLUE "🐳 Checking Docker availability..."
    
    if ! command -v docker >/dev/null 2>&1; then
        print_status $RED "❌ Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker info >/dev/null 2>&1; then
        print_status $RED "❌ Docker daemon is not running"
        print_status $YELLOW "💡 Please start Docker Desktop or Docker daemon"
        exit 1
    fi
    
    if ! command -v docker-compose >/dev/null 2>&1; then
        print_status $RED "❌ Docker Compose is not installed or not in PATH"
        exit 1
    fi
    
    print_status $GREEN "✅ Docker is available and running"
}

# Function to check Node.js
check_nodejs() {
    print_status $BLUE "🟢 Checking Node.js availability..."
    
    if ! command -v node >/dev/null 2>&1; then
        print_status $RED "❌ Node.js is not installed or not in PATH"
        print_status $YELLOW "💡 Please install Node.js version 18 or higher"
        exit 1
    fi
    
    local node_version=$(node -v | sed 's/v//')
    local major_version=$(echo $node_version | cut -d. -f1)
    
    if [ "$major_version" -lt 18 ]; then
        print_status $RED "❌ Node.js version $node_version is too old (requires ≥18.0.0)"
        exit 1
    fi
    
    print_status $GREEN "✅ Node.js version $node_version is compatible"
}

# Main function
main() {
    print_status $BLUE "🚀 StokCerdas Port Conflict Checker"
    print_status $BLUE "======================================"
    echo
    
    # Parse command line arguments
    AUTO_KILL=false
    SKIP_PREREQ=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --auto-kill|-k)
                AUTO_KILL=true
                shift
                ;;
            --skip-prereq)
                SKIP_PREREQ=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --auto-kill, -k    Automatically kill conflicting processes"
                echo "  --skip-prereq      Skip prerequisite checks"
                echo "  --help, -h         Show this help message"
                exit 0
                ;;
            *)
                print_status $RED "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Check prerequisites
    if [ "$SKIP_PREREQ" = "false" ]; then
        check_docker
        check_nodejs
        echo
    fi
    
    print_status $BLUE "🔍 Checking port conflicts..."
    echo
    
    local conflicts=0
    local total_ports=${#PORTS[@]}
    
    for port in "${!PORTS[@]}"; do
        local service="${PORTS[$port]}"
        local pid=$(check_port $port)
        
        if [ ! -z "$pid" ]; then
            conflicts=$((conflicts + 1))
            kill_process $pid $port "$service"
        else
            print_status $GREEN "✅ Port $port ($service) is available"
        fi
    done
    
    echo
    print_status $BLUE "📊 Summary:"
    print_status $BLUE "==========="
    print_status $GREEN "✅ Checked $total_ports ports"
    
    if [ $conflicts -eq 0 ]; then
        print_status $GREEN "🎉 No port conflicts found! StokCerdas is ready to start."
        echo
        print_status $BLUE "🚀 Next steps:"
        print_status $BLUE "  1. docker-compose up -d"
        print_status $BLUE "  2. npm install"
        print_status $BLUE "  3. npm run migration:run"
        print_status $BLUE "  4. npm run seed:run"
        print_status $BLUE "  5. npm run dev"
    else
        if [ "$AUTO_KILL" = "true" ]; then
            print_status $GREEN "🔧 Resolved $conflicts port conflicts automatically"
        else
            print_status $YELLOW "⚠️  Found $conflicts port conflicts (check above for details)"
        fi
        echo
        print_status $BLUE "💡 Run with --auto-kill to automatically resolve conflicts:"
        print_status $BLUE "   ./scripts/check-ports.sh --auto-kill"
    fi
    
    echo
}

# Create scripts directory if it doesn't exist
mkdir -p "$(dirname "$0")"

# Run main function
main "$@"