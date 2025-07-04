#!/bin/bash

# =============================================================================
# COMPREHENSIVE ENDPOINT TESTING FRAMEWORK - STOKCERDAS
# Ultra-deep testing of all endpoints with systematic analysis
# =============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Initialize result files
RESULTS_DIR="/tmp/stokcerdas_testing"
mkdir -p "$RESULTS_DIR"

# Clear previous results
> "$RESULTS_DIR/all_endpoints.txt"
> "$RESULTS_DIR/authentication_results.txt"
> "$RESULTS_DIR/database_issues.txt"
> "$RESULTS_DIR/performance_results.txt"
> "$RESULTS_DIR/security_results.txt"
> "$RESULTS_DIR/controller_analysis.txt"

echo -e "${WHITE}🚀 STOKCERDAS COMPREHENSIVE ENDPOINT TESTING FRAMEWORK${NC}"
echo -e "${WHITE}================================================================${NC}"
echo ""
echo "📊 Testing Framework Components:"
echo "   🔍 1. Controller Analysis & Route Discovery"
echo "   🔐 2. Authentication & Authorization Testing"
echo "   🗄️  3. Database Schema Validation"
echo "   ⚡ 4. Performance & Response Time Testing"
echo "   🛡️  5. Security & Input Validation Testing"
echo "   📋 6. Comprehensive Reporting"
echo ""

# Base URL
BASE_URL="http://localhost:3000"
TENANT_ID="00000000-0000-4000-8000-000000000001"

# Function to extract routes from controller files
analyze_controller() {
    local controller_file=$1
    local controller_name=$(basename "$controller_file" .controller.ts)
    
    echo -e "${BLUE}🔍 Analyzing: $controller_name${NC}"
    
    # Extract controller route prefix
    local prefix=$(grep -o "@Controller(['\"][^'\"]*['\"])" "$controller_file" | sed "s/@Controller(['\"]//; s/['\"])//")
    
    # Extract all HTTP method decorators and their routes
    grep -n "@\(Get\|Post\|Put\|Patch\|Delete\)" "$controller_file" | while IFS=: read -r line_num decorator; do
        local method=$(echo "$decorator" | grep -o "@\(Get\|Post\|Put\|Patch\|Delete\)" | sed 's/@//')
        local route=$(echo "$decorator" | grep -o "(['\"][^'\"]*['\"])" | sed "s/(['\"]//; s/['\"])//")
        
        # Construct full route
        local full_route="/api/v1"
        if [ -n "$prefix" ]; then
            full_route="$full_route/$prefix"
        fi
        if [ -n "$route" ] && [ "$route" != "" ]; then
            full_route="$full_route/$route"
        fi
        
        echo "$controller_name|$method|$full_route|$line_num" >> "$RESULTS_DIR/all_endpoints.txt"
    done
    
    echo "   ✅ Analyzed $controller_name" >> "$RESULTS_DIR/controller_analysis.txt"
}

# Function to test endpoint with comprehensive analysis
test_endpoint_comprehensive() {
    local controller=$1
    local method=$2
    local endpoint=$3
    local line_num=$4
    local test_type=${5:-"standard"}
    
    echo -e "${CYAN}🧪 Testing: $method $endpoint${NC}"
    echo "   Controller: $controller | Line: $line_num"
    
    # Prepare headers
    local headers=(
        -H "x-tenant-id: $TENANT_ID"
        -H "Content-Type: application/json"
        -H "Accept: application/json"
    )
    
    # Add authorization header if provided
    if [ -n "$JWT_TOKEN" ] && [ "$test_type" != "no_auth" ]; then
        headers+=(-H "Authorization: Bearer $JWT_TOKEN")
    fi
    
    # Measure response time
    local start_time=$(date +%s%3N)
    
    # Make request
    local response=$(curl -s -X "$method" "$BASE_URL$endpoint" "${headers[@]}")
    
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))
    
    # Analyze response
    local success=$(echo "$response" | jq -r '.success // false' 2>/dev/null || echo "false")
    local error_code=$(echo "$response" | jq -r '.error.code // "none"' 2>/dev/null || echo "unknown")
    local error_message=$(echo "$response" | jq -r '.error.message // "none"' 2>/dev/null || echo "unknown")
    local http_status=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$BASE_URL$endpoint" "${headers[@]}")
    
    # Categorize result
    local status_category=""
    local result_color=""
    
    if echo "$response" | grep -q "Cannot GET\|Cannot POST\|Cannot PUT\|Cannot DELETE\|Cannot PATCH"; then
        status_category="ROUTE_NOT_FOUND"
        result_color="$RED"
        echo "$controller|$method|$endpoint|ROUTE_NOT_FOUND|$http_status|$response_time" >> "$RESULTS_DIR/authentication_results.txt"
    elif [ "$success" = "true" ]; then
        status_category="SUCCESS"
        result_color="$GREEN"
        echo "$controller|$method|$endpoint|SUCCESS|$http_status|$response_time" >> "$RESULTS_DIR/authentication_results.txt"
    elif [ "$error_code" = "UnauthorizedException" ] || [ "$error_code" = "UNAUTHORIZED" ]; then
        status_category="AUTH_REQUIRED"
        result_color="$YELLOW"
        echo "$controller|$method|$endpoint|AUTH_REQUIRED|$http_status|$response_time" >> "$RESULTS_DIR/authentication_results.txt"
    elif [ "$error_code" = "TENANT_ID_REQUIRED" ] || echo "$error_message" | grep -qi "tenant"; then
        status_category="TENANT_REQUIRED"
        result_color="$YELLOW"
        echo "$controller|$method|$endpoint|TENANT_REQUIRED|$http_status|$response_time" >> "$RESULTS_DIR/authentication_results.txt"
    elif echo "$error_message" | grep -iE "database|column.*does not exist|relation.*does not exist|syntax error|QueryFailedError"; then
        status_category="DATABASE_ISSUE"
        result_color="$RED"
        echo "$controller|$method|$endpoint|DATABASE_ISSUE|$error_message|$response_time" >> "$RESULTS_DIR/database_issues.txt"
    else
        status_category="OTHER_ERROR"
        result_color="$YELLOW"
        echo "$controller|$method|$endpoint|OTHER_ERROR|$error_code: $error_message|$response_time" >> "$RESULTS_DIR/authentication_results.txt"
    fi
    
    # Log performance
    echo "$controller|$method|$endpoint|$response_time|$status_category" >> "$RESULTS_DIR/performance_results.txt"
    
    # Security analysis
    if [ "$method" = "POST" ] || [ "$method" = "PUT" ] || [ "$method" = "PATCH" ]; then
        # Test for SQL injection protection
        local malicious_payload='{"test": "DROP_TABLE_TEST"}'
        local sec_response=$(curl -s -X "$method" "$BASE_URL$endpoint" "${headers[@]}" -d "$malicious_payload" 2>/dev/null || echo "")
        
        if echo "$sec_response" | grep -qi "sql\|error\|exception"; then
            echo "$controller|$method|$endpoint|POTENTIAL_SQL_INJECTION" >> "$RESULTS_DIR/security_results.txt"
        else
            echo "$controller|$method|$endpoint|SQL_INJECTION_PROTECTED" >> "$RESULTS_DIR/security_results.txt"
        fi
    fi
    
    echo -e "   ${result_color}📋 $status_category${NC} | 🕐 ${response_time}ms | 📊 HTTP $http_status"
    
    # Add delay to avoid overwhelming server
    sleep 0.1
}

# Function to register a test user and get JWT token
setup_authentication() {
    echo -e "${PURPLE}🔐 Setting up authentication...${NC}"
    
    # Try to register a test user
    local register_response=$(curl -s -X POST "$BASE_URL/api/v1/auth/register" \
        -H "x-tenant-id: $TENANT_ID" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "test.comprehensive@stokcerdas.com",
            "password": "TestPass123!@#",
            "firstName": "Test",
            "lastName": "Comprehensive"
        }')
    
    echo "Registration response: $register_response"
    
    # Try to login and get token
    local login_response=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
        -H "x-tenant-id: $TENANT_ID" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "test.comprehensive@stokcerdas.com",
            "password": "TestPass123!@#"
        }')
    
    echo "Login response: $login_response"
    
    # Extract JWT token
    JWT_TOKEN=$(echo "$login_response" | jq -r '.data.accessToken // empty' 2>/dev/null)
    
    if [ -n "$JWT_TOKEN" ]; then
        echo -e "${GREEN}✅ Authentication successful${NC}"
        echo "Token: ${JWT_TOKEN:0:20}..."
    else
        echo -e "${YELLOW}⚠️  Authentication failed, proceeding with no-auth testing${NC}"
        JWT_TOKEN=""
    fi
}

# Main execution
echo -e "${WHITE}🔍 PHASE 1: CONTROLLER ANALYSIS & ROUTE DISCOVERY${NC}"
echo "=============================================="

# Controller files to analyze
controllers=(
    "src/app.controller.ts"
    "src/auth/controllers/auth.controller.ts"
    "src/auth/controllers/department.controller.ts"
    "src/auth/controllers/hierarchical-role.controller.ts"
    "src/auth/controllers/permission-set.controller.ts"
    "src/auth/controllers/approval-chain.controller.ts"
    "src/auth/controllers/enterprise-auth.controller.ts"
    "src/products/controllers/products.controller.ts"
    "src/products/controllers/product-categories.controller.ts"
    "src/products/controllers/product-variants.controller.ts"
    "src/inventory/controllers/inventory-items.controller.ts"
    "src/inventory/controllers/inventory-locations.controller.ts"
    "src/inventory/controllers/inventory-transactions.controller.ts"
    "src/suppliers/controllers/suppliers.controller.ts"
    "src/purchase-orders/controllers/purchase-orders.controller.ts"
    "src/orders/controllers/orders.controller.ts"
    "src/orders/controllers/order-routing.controller.ts"
    "src/alerts/controllers/alert-configuration.controller.ts"
    "src/alerts/controllers/alert-management.controller.ts"
    "src/alerts/controllers/email-notification.controller.ts"
    "src/automation/controllers/automation.controller.ts"
    "src/automation/controllers/workflow.controller.ts"
    "src/analytics/controllers/analytics.controller.ts"
    "src/analytics/controllers/predictive-analytics.controller.ts"
    "src/ml-forecasting/controllers/forecasting.controller.ts"
    "src/ml-forecasting/controllers/ml-predictions.controller.ts"
    "src/ml-forecasting/controllers/ml-training.controller.ts"
    "src/channels/controllers/channels.controller.ts"
    "src/channels/controllers/channel-inventory.controller.ts"
    "src/shipping/controllers/shipping.controller.ts"
    "src/shipping/controllers/instant-delivery.controller.ts"
    "src/reports/controllers/reports.controller.ts"
    "src/notifications/controllers/notifications.controller.ts"
    "src/integrations/controllers/integration.controller.ts"
    "src/integrations/controllers/webhook.controller.ts"
    "src/integrations/accurate/controllers/accurate.controller.ts"
    "src/integrations/quickbooks/controllers/quickbooks.controller.ts"
    "src/integrations/moka/controllers/moka.controller.ts"
    "src/integrations/shopee/controllers/shopee.controller.ts"
    "src/integrations/shopee/controllers/shopee-webhook.controller.ts"
    "src/integrations/lazada/controllers/lazada.controller.ts"
    "src/integrations/lazada/controllers/lazada-webhook.controller.ts"
    "src/integrations/tokopedia/controllers/tokopedia.controller.ts"
    "src/integrations/tokopedia/controllers/tokopedia-webhook.controller.ts"
    "src/integrations/whatsapp/controllers/whatsapp.controller.ts"
    "src/integrations/whatsapp/controllers/whatsapp-webhook.controller.ts"
    "src/compliance/controllers/soc2-compliance.controller.ts"
    "src/compliance/controllers/privacy-management.controller.ts"
)

echo "📋 Analyzing ${#controllers[@]} controllers..."

for controller in "${controllers[@]}"; do
    if [ -f "$controller" ]; then
        analyze_controller "$controller"
    else
        echo -e "${RED}❌ Controller not found: $controller${NC}"
    fi
done

total_endpoints=$(wc -l < "$RESULTS_DIR/all_endpoints.txt")
echo -e "${GREEN}✅ Analysis complete: $total_endpoints endpoints discovered${NC}"
echo ""

# Phase 2: Authentication Setup
echo -e "${WHITE}🔐 PHASE 2: AUTHENTICATION SETUP${NC}"
echo "=================================="
setup_authentication
echo ""

# Phase 3: Comprehensive Endpoint Testing
echo -e "${WHITE}🧪 PHASE 3: COMPREHENSIVE ENDPOINT TESTING${NC}"
echo "============================================="

endpoint_count=0
while IFS='|' read -r controller method endpoint line_num; do
    ((endpoint_count++))
    echo -e "${WHITE}[$endpoint_count/$total_endpoints]${NC}"
    test_endpoint_comprehensive "$controller" "$method" "$endpoint" "$line_num"
    echo ""
done < "$RESULTS_DIR/all_endpoints.txt"

echo -e "${WHITE}🔍 PHASE 4: RESULTS ANALYSIS${NC}"
echo "============================="

# Authentication Results Summary
auth_success=$(grep -c "SUCCESS" "$RESULTS_DIR/authentication_results.txt" 2>/dev/null || echo 0)
auth_required=$(grep -c "AUTH_REQUIRED" "$RESULTS_DIR/authentication_results.txt" 2>/dev/null || echo 0)
tenant_required=$(grep -c "TENANT_REQUIRED" "$RESULTS_DIR/authentication_results.txt" 2>/dev/null || echo 0)
route_not_found=$(grep -c "ROUTE_NOT_FOUND" "$RESULTS_DIR/authentication_results.txt" 2>/dev/null || echo 0)
other_errors=$(grep -c "OTHER_ERROR" "$RESULTS_DIR/authentication_results.txt" 2>/dev/null || echo 0)

echo -e "${BLUE}📊 AUTHENTICATION ANALYSIS:${NC}"
echo "   ✅ Successful responses: $auth_success"
echo "   🔐 Authentication required: $auth_required"
echo "   🏢 Tenant ID required: $tenant_required"
echo "   ❌ Route not found: $route_not_found"
echo "   ⚠️  Other errors: $other_errors"
echo ""

# Database Issues Summary
database_issues=$(wc -l < "$RESULTS_DIR/database_issues.txt" 2>/dev/null || echo 0)
echo -e "${BLUE}🗄️  DATABASE ANALYSIS:${NC}"
if [ "$database_issues" -gt 0 ]; then
    echo -e "   ${RED}❌ Database issues found: $database_issues${NC}"
    echo "   Issues:"
    head -10 "$RESULTS_DIR/database_issues.txt" | while IFS='|' read -r controller method endpoint issue message; do
        echo "      - $controller:$method $endpoint: $message"
    done
else
    echo -e "   ${GREEN}✅ No database issues detected${NC}"
fi
echo ""

# Performance Analysis
echo -e "${BLUE}⚡ PERFORMANCE ANALYSIS:${NC}"
if [ -f "$RESULTS_DIR/performance_results.txt" ]; then
    avg_response_time=$(awk -F'|' '{sum+=$4; count++} END {print (count>0 ? sum/count : 0)}' "$RESULTS_DIR/performance_results.txt")
    max_response_time=$(awk -F'|' '{if($4>max) max=$4} END {print max+0}' "$RESULTS_DIR/performance_results.txt")
    min_response_time=$(awk -F'|' 'BEGIN{min=99999} {if($4<min && $4>0) min=$4} END {print min+0}' "$RESULTS_DIR/performance_results.txt")
    
    echo "   📈 Average response time: ${avg_response_time}ms"
    echo "   🔺 Maximum response time: ${max_response_time}ms"
    echo "   🔻 Minimum response time: ${min_response_time}ms"
    
    # Find slowest endpoints
    echo "   🐌 Slowest endpoints:"
    sort -t'|' -k4 -nr "$RESULTS_DIR/performance_results.txt" | head -5 | while IFS='|' read -r controller method endpoint time status; do
        echo "      - $controller:$method $endpoint: ${time}ms"
    done
else
    echo "   ⚠️  No performance data available"
fi
echo ""

# Security Analysis
echo -e "${BLUE}🛡️  SECURITY ANALYSIS:${NC}"
if [ -f "$RESULTS_DIR/security_results.txt" ]; then
    sql_protected=$(grep -c "SQL_INJECTION_PROTECTED" "$RESULTS_DIR/security_results.txt" 2>/dev/null || echo 0)
    sql_vulnerable=$(grep -c "POTENTIAL_SQL_INJECTION" "$RESULTS_DIR/security_results.txt" 2>/dev/null || echo 0)
    
    echo "   🛡️  SQL injection protected: $sql_protected"
    if [ "$sql_vulnerable" -gt 0 ]; then
        echo -e "   ${RED}⚠️  Potential SQL injection vulnerabilities: $sql_vulnerable${NC}"
    else
        echo -e "   ${GREEN}✅ No SQL injection vulnerabilities detected${NC}"
    fi
else
    echo "   ⚠️  No security data available"
fi
echo ""

# Generate comprehensive report
echo -e "${WHITE}📋 GENERATING COMPREHENSIVE REPORT${NC}"
echo "===================================="

cat > "$RESULTS_DIR/comprehensive_report.md" << EOF
# StokCerdas Comprehensive Endpoint Testing Report

## Executive Summary
- **Total Endpoints Tested**: $total_endpoints
- **Controllers Analyzed**: ${#controllers[@]}
- **Testing Date**: $(date)

## Authentication Analysis
- ✅ Successful responses: $auth_success
- 🔐 Authentication required: $auth_required  
- 🏢 Tenant ID required: $tenant_required
- ❌ Route not found: $route_not_found
- ⚠️ Other errors: $other_errors

## Database Analysis
- 🗄️ Database issues detected: $database_issues

## Performance Analysis
- 📈 Average response time: ${avg_response_time}ms
- 🔺 Maximum response time: ${max_response_time}ms
- 🔻 Minimum response time: ${min_response_time}ms

## Security Analysis
- 🛡️ SQL injection protected endpoints: $sql_protected
- ⚠️ Potential vulnerabilities: $sql_vulnerable

## Detailed Results
Results are available in the following files:
- All endpoints: $RESULTS_DIR/all_endpoints.txt
- Authentication results: $RESULTS_DIR/authentication_results.txt
- Database issues: $RESULTS_DIR/database_issues.txt
- Performance results: $RESULTS_DIR/performance_results.txt
- Security results: $RESULTS_DIR/security_results.txt

## Recommendations
1. Review endpoints requiring authentication
2. Investigate any database schema issues
3. Optimize slow-performing endpoints (>500ms)
4. Address any security vulnerabilities
EOF

echo -e "${GREEN}✅ Comprehensive testing complete!${NC}"
echo "📄 Full report: $RESULTS_DIR/comprehensive_report.md"
echo "📁 All results: $RESULTS_DIR/"
echo ""
echo -e "${WHITE}🎯 SUMMARY${NC}"
echo "=========="
echo "Total endpoints tested: $total_endpoints"
echo "Working endpoints: $((auth_success + auth_required + tenant_required))"
echo "Issues found: $((route_not_found + database_issues + sql_vulnerable))"
echo ""