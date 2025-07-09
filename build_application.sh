#!/bin/bash

echo "🏗️ StokCerdas Application Build & Deployment"
echo "============================================="

# Set production environment
export NODE_ENV=production
set -a
source .env.production
set +a

# Create logs directory
mkdir -p logs

# Step 1: Install dependencies
echo "📦 Installing production dependencies..."
echo "Start time: $(date)"
npm ci --production 2>&1 | tee logs/npm_install_$(date +%Y%m%d_%H%M%S).log

if [ $? -ne 0 ]; then
    echo "❌ npm install failed"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Step 2: Build application
echo ""
echo "🏗️ Building application..."
echo "Start time: $(date)"
npm run build 2>&1 | tee logs/build_$(date +%Y%m%d_%H%M%S).log

if [ $? -ne 0 ]; then
    echo "❌ Application build failed"
    exit 1
fi

echo "✅ Application build completed"

# Step 3: Run type checking
echo ""
echo "🔍 Running TypeScript type checking..."
npm run typecheck 2>&1 | tee logs/typecheck_$(date +%Y%m%d_%H%M%S).log

if [ $? -ne 0 ]; then
    echo "❌ TypeScript type checking failed"
    exit 1
fi

echo "✅ TypeScript type checking passed"

# Step 4: Run linting
echo ""
echo "🧹 Running ESLint..."
npm run lint 2>&1 | tee logs/lint_$(date +%Y%m%d_%H%M%S).log

if [ $? -ne 0 ]; then
    echo "❌ ESLint failed"
    exit 1
fi

echo "✅ ESLint passed"

# Step 5: Verify build artifacts
echo ""
echo "📊 Verifying build artifacts..."
if [ -d "dist" ]; then
    echo "✅ dist/ directory exists"
    
    # Check critical files
    critical_files=(
        "dist/main.js"
        "dist/src/app.module.js"
        "dist/src/config"
        "dist/src/database"
    )
    
    for file in "${critical_files[@]}"; do
        if [ -e "$file" ]; then
            echo "✅ $file exists"
        else
            echo "❌ $file missing"
        fi
    done
    
    # Show build size
    echo ""
    echo "📁 Build directory size:"
    du -sh dist/
    
    # Show dist contents
    echo ""
    echo "📋 Build artifacts:"
    ls -la dist/ | head -10
    
    echo "✅ Build artifacts verified"
else
    echo "❌ dist/ directory not found"
    exit 1
fi

echo ""
echo "🎯 Build Statistics:"
echo "Timestamp: $(date)"
echo "Build logs saved to: logs/"
echo "✅ Application build validation complete"

echo ""
echo "🚀 Ready for container deployment!"
echo "Next step: docker compose -f docker-compose.prod.yml up -d app"