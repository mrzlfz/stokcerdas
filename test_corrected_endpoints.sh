#!/bin/bash

# =============================================================================
# COMPREHENSIVE ENDPOINT TESTING - CORRECTED ROUTES
# =============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🔍 COMPREHENSIVE ENDPOINT TESTING - CORRECTED ROUTES"
echo "=================================================="

# Test function
test_endpoint() {
    local endpoint=$1
    local name=$2
    local method=${3:-GET}
    
    echo ""
    echo -e "${BLUE}🧪 Testing: $name${NC}"
    echo "   Route: $endpoint"
    echo "   Method: $method"
    
    local response=$(curl -s -X $method "$endpoint" \
      -H "x-tenant-id: 00000000-0000-4000-8000-000000000001" \
      -H "Content-Type: application/json")
    
    # Check if response contains "Cannot GET" or "Cannot POST" etc
    if echo "$response" | grep -q "Cannot GET\|Cannot POST\|Cannot PUT\|Cannot DELETE\|Cannot PATCH"; then
        echo -e "   ${RED}❌ ROUTE NOT FOUND${NC}"
        echo "   Error: $(echo "$response" | jq -r '.error.message // "Route not found"')"
        echo "$name|ROUTE_NOT_FOUND|$endpoint" >> /tmp/routing_issues.txt
    else
        # Route found - check for other types of errors
        local error_code=$(echo "$response" | jq -r '.error.code // "none"')
        local error_message=$(echo "$response" | jq -r '.error.message // "none"')
        local success=$(echo "$response" | jq -r '.success // false')
        
        if [ "$success" = "true" ]; then
            echo -e "   ${GREEN}✅ SUCCESS${NC}"
        elif [ "$error_code" = "UnauthorizedException" ]; then
            echo -e "   ${GREEN}✅ ROUTE OK (Auth Required)${NC}"
            echo "   Note: Route exists but needs authentication"
        elif [ "$error_code" = "TENANT_ID_REQUIRED" ]; then
            echo -e "   ${GREEN}✅ ROUTE OK (Tenant Required)${NC}"
            echo "   Note: Route exists but needs tenant header"
        elif echo "$error_message" | grep -iE "database|column.*does not exist|relation.*does not exist|syntax error|QueryFailedError" > /dev/null; then
            echo -e "   ${YELLOW}⚠️  DATABASE SCHEMA ISSUE${NC}"
            echo "   Error: $error_message"
            echo "$name|DATABASE_ISSUE|$error_message" >> /tmp/database_issues.txt
        else
            echo -e "   ${YELLOW}⚠️  OTHER ERROR${NC}"
            echo "   Code: $error_code"
            echo "   Error: $error_message"
        fi
    fi
}

# Initialize results files
> /tmp/routing_issues.txt
> /tmp/database_issues.txt

echo ""
echo "📋 Testing Enterprise Auth Endpoints (CORRECTED ROUTES)"
echo "======================================================="

# Enterprise Auth Endpoints - CORRECTED ROUTES
test_endpoint "http://localhost:3000/api/v1/departments" "Departments - List All"
test_endpoint "http://localhost:3000/api/v1/hierarchical-roles" "Hierarchical Roles - List All"
test_endpoint "http://localhost:3000/api/v1/permission-sets" "Permission Sets - List All"
test_endpoint "http://localhost:3000/api/v1/approval-chains" "Approval Chains - List All"

echo ""
echo "📋 Testing Other Previously Failing Endpoints"
echo "=============================================="

# Alert and Automation endpoints
test_endpoint "http://localhost:3000/api/v1/alerts/configurations" "Alert Configurations"
test_endpoint "http://localhost:3000/api/v1/automation/workflows" "Workflows"

echo ""
echo "📋 Testing Core Auth Endpoints (Verification)"
echo "=============================================="

# Core auth endpoints (should work)
test_endpoint "http://localhost:3000/api/v1/auth/login" "Auth - Login" "POST"
test_endpoint "http://localhost:3000/api/v1/auth/register" "Auth - Register" "POST"

echo ""
echo "📋 Testing Some Core Endpoints (Verification)"
echo "=============================================="

# Core endpoints that should work
test_endpoint "http://localhost:3000/api/v1/products" "Products - List All"
test_endpoint "http://localhost:3000/api/v1/inventory/items" "Inventory Items"
test_endpoint "http://localhost:3000/api/v1/suppliers" "Suppliers"

echo ""
echo "🔍 ROUTING ISSUES SUMMARY"
echo "========================="

if [ -s /tmp/routing_issues.txt ]; then
    echo -e "${RED}❌ ROUTES NOT FOUND:${NC}"
    cat /tmp/routing_issues.txt | while IFS='|' read -r name issue endpoint; do
        echo "   - $name: $endpoint"
    done
    echo ""
    echo "Total routing issues: $(wc -l < /tmp/routing_issues.txt)"
else
    echo -e "${GREEN}✅ ALL ROUTES FOUND!${NC}"
fi

echo ""
echo "🔍 DATABASE ISSUES SUMMARY"
echo "=========================="

if [ -s /tmp/database_issues.txt ]; then
    echo -e "${YELLOW}⚠️  DATABASE SCHEMA ISSUES FOUND:${NC}"
    cat /tmp/database_issues.txt | while IFS='|' read -r name issue error; do
        echo "   - $name: $error"
    done
    echo ""
    echo "Total database issues: $(wc -l < /tmp/database_issues.txt)"
else
    echo -e "${GREEN}✅ NO DATABASE ISSUES FOUND!${NC}"
fi

echo ""
echo "🎯 CONCLUSION"
echo "============="
echo "This comprehensive test shows the real status of routing vs database issues."
echo "Any remaining 'Cannot GET' errors indicate actual missing routes."
echo "Any 'database/column does not exist' errors indicate schema problems."
echo ""

# Cleanup
rm -f /tmp/routing_issues.txt /tmp/database_issues.txt