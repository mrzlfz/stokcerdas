#!/bin/bash

# Comprehensive Endpoint Testing Script for StokCerdas Database Issues
echo "🚀 Starting comprehensive endpoint testing for database schema issues..."

# Get authentication token
echo "🔐 Getting authentication token..."
JWT_TOKEN=$(curl -s -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 00000000-0000-4000-8000-000000000001" \
  -d '{"email": "admin@stokcerdas.test", "password": "admin123"}' | jq -r '.data.accessToken')

if [ "$JWT_TOKEN" = "null" ] || [ -z "$JWT_TOKEN" ]; then
  echo "❌ Failed to get authentication token"
  exit 1
fi
echo "✅ Token obtained successfully"

# Test function
test_endpoint() {
  local endpoint=$1
  local name=$2
  local method=${3:-GET}
  
  echo "🧪 Testing $name..."
  
  local response=$(curl -s -X $method "$endpoint" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "x-tenant-id: 00000000-0000-4000-8000-000000000001" \
    -H "Content-Type: application/json")
  
  local success=$(echo "$response" | jq -r '.success // false')
  local error_code=$(echo "$response" | jq -r '.error.code // "none"')
  local error_message=$(echo "$response" | jq -r '.error.message // "none"')
  
  if [ "$success" = "true" ]; then
    echo "✅ $name: SUCCESS"
  else
    echo "❌ $name: FAILED"
    echo "   Error Code: $error_code"
    echo "   Error: $error_message"
    
    # Check if it's a database-related error
    if echo "$error_message" | grep -iE "column.*does not exist|relation.*does not exist|syntax error|database|QueryFailedError" > /dev/null; then
      echo "   🔍 DATABASE SCHEMA ISSUE DETECTED"
      echo "$name|$error_message" >> /tmp/database_issues.txt
    fi
  fi
  echo ""
}

# Create file to track database issues
> /tmp/database_issues.txt

echo "==================== TESTING ALL ENDPOINTS SYSTEMATICALLY ===================="

echo "📦 PRODUCTS MODULE"
test_endpoint "http://localhost:3000/api/v1/products" "Products - List All"
test_endpoint "http://localhost:3000/api/v1/products/categories" "Product Categories - List All"
test_endpoint "http://localhost:3000/api/v1/products/categories/tree" "Product Categories - Tree"
test_endpoint "http://localhost:3000/api/v1/products/variants" "Product Variants - List All"

echo "🏭 SUPPLIERS MODULE"
test_endpoint "http://localhost:3000/api/v1/suppliers" "Suppliers - List All"

echo "📋 PURCHASE ORDERS MODULE"
test_endpoint "http://localhost:3000/api/v1/purchase-orders" "Purchase Orders - List All"

echo "📊 INVENTORY MODULE"
test_endpoint "http://localhost:3000/api/v1/inventory/items" "Inventory Items - List All"
test_endpoint "http://localhost:3000/api/v1/inventory/locations" "Inventory Locations - List All"
test_endpoint "http://localhost:3000/api/v1/inventory/transactions" "Inventory Transactions - List All"

echo "🔐 AUTHENTICATION & AUTHORIZATION MODULE"
test_endpoint "http://localhost:3000/api/v1/auth/profile" "Auth - Profile"
test_endpoint "http://localhost:3000/api/v1/departments" "Departments - List All"
test_endpoint "http://localhost:3000/api/v1/hierarchical-roles" "Hierarchical Roles - List All"
test_endpoint "http://localhost:3000/api/v1/permission-sets" "Permission Sets - List All"
test_endpoint "http://localhost:3000/api/v1/approval-chains" "Approval Chains - List All"

echo "📈 ANALYTICS & ML MODULE"
test_endpoint "http://localhost:3000/api/v1/analytics" "Analytics - Dashboard"
test_endpoint "http://localhost:3000/api/v1/analytics/predictive" "Predictive Analytics"
test_endpoint "http://localhost:3000/api/v1/ml/forecasting" "ML Forecasting"
test_endpoint "http://localhost:3000/api/v1/ml/predictions" "ML Predictions"
test_endpoint "http://localhost:3000/api/v1/ml/training" "ML Training"

echo "🛒 ORDER MANAGEMENT MODULE"
test_endpoint "http://localhost:3000/api/v1/orders" "Orders - List All"
test_endpoint "http://localhost:3000/api/v1/order-routing" "Order Routing"

echo "🚨 ALERTS MODULE"
test_endpoint "http://localhost:3000/api/v1/alert-configurations" "Alert Configurations"
test_endpoint "http://localhost:3000/api/v1/alert-management" "Alert Management"
test_endpoint "http://localhost:3000/api/v1/alert-notifications" "Alert Notifications"

echo "⚙️ AUTOMATION MODULE"
test_endpoint "http://localhost:3000/api/v1/automation" "Automation Rules"
test_endpoint "http://localhost:3000/api/v1/workflows" "Workflows"

echo "📺 CHANNELS MODULE"
test_endpoint "http://localhost:3000/api/v1/channels" "Channels - List All"
test_endpoint "http://localhost:3000/api/v1/channels/inventory" "Channel Inventory"

echo "🚚 SHIPPING MODULE"
test_endpoint "http://localhost:3000/api/v1/shipping" "Shipping"
test_endpoint "http://localhost:3000/api/v1/instant-delivery" "Instant Delivery"

echo "🔔 NOTIFICATIONS MODULE"
test_endpoint "http://localhost:3000/api/v1/notifications" "Notifications"

echo "📊 REPORTS MODULE"
test_endpoint "http://localhost:3000/api/v1/reports" "Reports"

echo "🔗 INTEGRATIONS MODULE"
test_endpoint "http://localhost:3000/api/v1/integrations" "Integrations"
test_endpoint "http://localhost:3000/api/v1/integrations/shopee" "Shopee Integration"
test_endpoint "http://localhost:3000/api/v1/integrations/tokopedia" "Tokopedia Integration"
test_endpoint "http://localhost:3000/api/v1/integrations/lazada" "Lazada Integration"
test_endpoint "http://localhost:3000/api/v1/integrations/quickbooks" "QuickBooks Integration"
test_endpoint "http://localhost:3000/api/v1/integrations/accurate" "Accurate Integration"
test_endpoint "http://localhost:3000/api/v1/integrations/moka" "Moka POS Integration"
test_endpoint "http://localhost:3000/api/v1/integrations/whatsapp" "WhatsApp Integration"

echo "⚖️ COMPLIANCE MODULE"
test_endpoint "http://localhost:3000/api/v1/compliance/soc2" "SOC2 Compliance"
test_endpoint "http://localhost:3000/api/v1/compliance/privacy" "Privacy Management"

echo "==================== TESTING COMPLETE ===================="

# Show summary of database issues found
if [ -s /tmp/database_issues.txt ]; then
  echo "🔍 DATABASE SCHEMA ISSUES FOUND:"
  echo "================================"
  cat /tmp/database_issues.txt
  echo ""
  echo "📊 Total endpoints with database issues: $(wc -l < /tmp/database_issues.txt)"
else
  echo "✅ No database schema issues detected in tested endpoints"
fi

echo "🏁 Endpoint testing completed!"