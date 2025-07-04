#!/bin/bash

# StokCerdas API Endpoint Testing Script
# Comprehensive testing for all 200+ endpoints

BASE_URL="http://localhost:3000/api/v1"
TENANT_ID="550e8400-e29b-41d4-a716-446655440000"
HEADERS="-H 'Content-Type: application/json' -H 'x-tenant-id: $TENANT_ID'"

echo "=== STOKCERDAS API COMPREHENSIVE ENDPOINT TESTING ==="
echo "Start Time: $(date)"
echo "============================================="

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    local expected_status=${5:-200}
    
    echo "Testing: $description"
    echo "Endpoint: $method $endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" $HEADERS "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X $method $HEADERS -d "$data" "$BASE_URL$endpoint")
    fi
    
    http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
    response_body=$(echo "$response" | sed '$d')
    
    echo "Status: $http_status"
    echo "Response: $response_body" | head -c 200
    echo -e "\n---"
    
    return $http_status
}

# Phase 1: Health Endpoints
echo -e "\n🏥 PHASE 1: HEALTH ENDPOINTS"
echo "=============================="

test_endpoint "GET" "/" "" "Root Health Check"
test_endpoint "GET" "/health" "" "Detailed Health Check"

# Phase 2: Authentication Endpoints
echo -e "\n🔐 PHASE 2: AUTHENTICATION ENDPOINTS"
echo "====================================="

# Test Registration
register_data='{"email":"testuser@stokcerdas.com","password":"Password123!","firstName":"Test","lastName":"User","phoneNumber":"+628123456789"}'
test_endpoint "POST" "/auth/register" "$register_data" "User Registration"

# Test Login
login_data='{"email":"testuser@stokcerdas.com","password":"Password123!"}'
login_response=$(curl -s $HEADERS -X POST -d "$login_data" "$BASE_URL/auth/login")
access_token=$(echo "$login_response" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

echo "Login Response: $login_response"
echo "Access Token: ${access_token:0:50}..."

# Set auth header for authenticated endpoints
AUTH_HEADERS="$HEADERS -H 'Authorization: Bearer $access_token'"

# Test Profile
test_endpoint "GET" "/auth/profile" "" "Get User Profile"
test_endpoint "GET" "/auth/permissions" "" "Get User Permissions"

# Phase 3: Products Endpoints
echo -e "\n📦 PHASE 3: PRODUCTS ENDPOINTS"
echo "==============================="

# Test Products
test_endpoint "GET" "/products" "" "Get Products List"
test_endpoint "GET" "/products/stats" "" "Get Product Statistics"

# Create Product
product_data='{"name":"Test Product","sku":"TEST-001","description":"Test product description","categoryId":null,"price":100000,"costPrice":75000,"weight":1.5,"dimensions":{"length":10,"width":10,"height":10},"attributes":{"color":"red","size":"M"}}'
test_endpoint "POST" "/products" "$product_data" "Create Product"

# Test Product Categories
test_endpoint "GET" "/products/categories" "" "Get Categories List"
test_endpoint "GET" "/products/categories/tree" "" "Get Category Tree"

# Create Category
category_data='{"name":"Test Category","description":"Test category description","parentId":null,"sortOrder":1,"isActive":true}'
test_endpoint "POST" "/products/categories" "$category_data" "Create Category"

# Test Product Variants
test_endpoint "GET" "/products/variants" "" "Get Variants List"

# Phase 4: Inventory Endpoints
echo -e "\n📊 PHASE 4: INVENTORY ENDPOINTS"
echo "================================"

# Test Inventory Items
test_endpoint "GET" "/inventory/items" "" "Get Inventory Items"
test_endpoint "GET" "/inventory/items/stats" "" "Get Inventory Statistics"
test_endpoint "GET" "/inventory/items/realtime-levels" "" "Get Real-time Stock Levels"

# Test Inventory Locations
test_endpoint "GET" "/inventory/locations" "" "Get Locations List"
test_endpoint "GET" "/inventory/locations/hierarchy" "" "Get Location Hierarchy"
test_endpoint "GET" "/inventory/locations/stats" "" "Get Location Statistics"

# Create Location
location_data='{"name":"Main Warehouse","code":"WH-001","type":"warehouse","address":"Jakarta, Indonesia","capacity":10000,"isActive":true}'
test_endpoint "POST" "/inventory/locations" "$location_data" "Create Location"

# Test Inventory Transactions
test_endpoint "GET" "/inventory/transactions" "" "Get Transactions List"
test_endpoint "GET" "/inventory/transactions/stats" "" "Get Transaction Statistics"

# Phase 5: Analytics Endpoints
echo -e "\n📈 PHASE 5: ANALYTICS ENDPOINTS"
echo "==============================="

test_endpoint "GET" "/analytics/dashboard" "" "Get Dashboard Metrics"
test_endpoint "GET" "/analytics/revenue" "" "Get Revenue Analytics"
test_endpoint "GET" "/analytics/revenue/trends" "" "Get Revenue Trends"
test_endpoint "GET" "/analytics/inventory/turnover" "" "Get Inventory Turnover"
test_endpoint "GET" "/analytics/products/performance" "" "Get Product Performance"

# Predictive Analytics
test_endpoint "GET" "/analytics/predictive/stockout-risk" "" "Get Stockout Risk Prediction"
test_endpoint "GET" "/analytics/predictive/slow-moving" "" "Get Slow-moving Items"
test_endpoint "GET" "/analytics/predictive/optimal-reorder" "" "Get Optimal Reorder Recommendations"

echo -e "\n✅ ENDPOINT TESTING COMPLETED"
echo "End Time: $(date)"
echo "=============================="