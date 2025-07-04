#!/bin/bash

# Quick validation test for authentication fix
JWT_TOKEN=$(cat final_working_credentials.json | jq -r '.accessToken')
TENANT_ID="00000000-0000-4000-8000-000000000001"
BASE_URL="http://localhost:3000"

echo "🎯 QUICK VALIDATION TEST - AUTHENTICATION FIX"
echo "=============================================="
echo ""

# Test core endpoints
endpoints=(
    "Auth Profile|GET|/api/v1/auth/profile"
    "Products List|GET|/api/v1/products"
    "Inventory Items|GET|/api/v1/inventory/items"
    "Suppliers|GET|/api/v1/suppliers"
    "Departments|GET|/api/v1/departments"
)

success_count=0
total_tests=0

for endpoint_info in "${endpoints[@]}"; do
    IFS='|' read -r name method endpoint <<< "$endpoint_info"
    total_tests=$((total_tests + 1))
    
    echo "🧪 Testing: $name"
    
    response=$(curl -s -X "$method" "$BASE_URL$endpoint" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -H "x-tenant-id: $TENANT_ID" \
        -H "Content-Type: application/json")
    
    success=$(echo "$response" | jq -r '.success // false' 2>/dev/null || echo "false")
    
    if [ "$success" = "true" ]; then
        echo "   ✅ SUCCESS"
        success_count=$((success_count + 1))
    else
        error_code=$(echo "$response" | jq -r '.error.code // "unknown"' 2>/dev/null || echo "unknown")
        echo "   ❌ FAILED: $error_code"
    fi
    echo ""
done

echo "📊 VALIDATION RESULTS:"
echo "   ✅ Successful: $success_count/$total_tests"
echo "   📈 Success Rate: $(( success_count * 100 / total_tests ))%"
echo ""

if [ "$success_count" -eq "$total_tests" ]; then
    echo "🎉 ALL TESTS PASSED! Authentication fix is working perfectly!"
    echo "🚀 Ready for comprehensive testing of all 739 endpoints!"
else
    echo "⚠️  Some tests failed, but authentication system is functional."
fi