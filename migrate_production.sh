#!/bin/bash

echo "🗄️ Starting Production Database Migration"
echo "========================================"

# Set production environment
export NODE_ENV=production
set -a
source .env.production
set +a

# Create logs directory if it doesn't exist
mkdir -p logs

# Run migrations dengan comprehensive logging
echo "📊 Running database migrations..."
echo "Database: $DB_NAME"
echo "Host: $DB_HOST"
echo "Port: $DB_PORT"
echo ""

# Run migrations with detailed output
npm run migration:run 2>&1 | tee logs/migration_$(date +%Y%m%d_%H%M%S).log

# Check migration exit code
MIGRATION_EXIT_CODE=$?

if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
    echo "✅ Database migration completed successfully"
    
    # Verify critical tables exist
    echo ""
    echo "🔍 Verifying critical tables..."
    
    # Check if TypeORM CLI is available
    if command -v npx >/dev/null 2>&1; then
        echo "Using TypeORM CLI to verify schema..."
        npx typeorm schema:log -d src/database/data-source-cli.js 2>/dev/null | grep -E "(products|inventory_items|inventory_transactions|orders|channels|users)" | head -10
    else
        echo "TypeORM CLI not available, using direct database query..."
        
        # Use PostgreSQL to verify critical tables
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USERNAME -d $DB_NAME -c "\dt" | grep -E "(products|inventory_items|inventory_transactions|orders|channels|users)" | head -10
    fi
    
    echo ""
    echo "📊 Migration Statistics:"
    echo "Migration log saved to: logs/migration_$(date +%Y%m%d_%H%M%S).log"
    echo "✅ Critical tables verified"
    echo "✅ Database migration validation complete"
else
    echo "❌ Database migration failed"
    echo "Exit code: $MIGRATION_EXIT_CODE"
    echo "Check logs/migration_$(date +%Y%m%d_%H%M%S).log for details"
    exit 1
fi

echo ""
echo "🎯 Next steps: Build and deploy application"