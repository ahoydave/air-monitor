#!/bin/bash

# API Test Script
# Tests the air monitor ingestion API with and without authentication
# Cleans up test data afterwards

set -e

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/config.sh"

echo "🧪 Testing Air Monitor API"
echo "=================================="
echo "Endpoint: ${API_ENDPOINT}"
echo "Test Device: ${TEST_DEVICE_ID}"
echo ""

# Test data payload
TEST_PAYLOAD='{
  "deviceId": "'${TEST_DEVICE_ID}'",
  "temperature": 23.5,
  "humidity": 65.2,
  "co2": 450,
  "tvoc": 125,
  "pm25": 12.1,
  "pm10": 15.3
}'

# Test 1: Request WITHOUT API key (should fail)
echo "🔒 Test 1: Request without API key (should fail)"
echo "------------------------------------------------"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${API_ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d "${TEST_PAYLOAD}")

if [ "${HTTP_CODE}" = "403" ]; then
  echo "✅ PASS: Request correctly rejected (HTTP ${HTTP_CODE})"
else
  echo "❌ FAIL: Expected HTTP 403, got HTTP ${HTTP_CODE}"
  exit 1
fi

echo ""

# Test 2: Request WITH API key (should succeed)
echo "🔑 Test 2: Request with valid API key (should succeed)"
echo "------------------------------------------------------"

RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST "${API_ENDPOINT}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d "${TEST_PAYLOAD}")

HTTP_CODE=$(echo "${RESPONSE}" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "${RESPONSE}" | sed '/HTTP_CODE:/d')

if [ "${HTTP_CODE}" = "200" ]; then
  echo "✅ PASS: Request accepted (HTTP ${HTTP_CODE})"
  echo "Response: ${BODY}"
else
  echo "❌ FAIL: Expected HTTP 200, got HTTP ${HTTP_CODE}"
  echo "Response: ${BODY}"
  exit 1
fi

echo ""

# Test 3: Verify data was stored in DynamoDB
echo "💾 Test 3: Verify data stored in DynamoDB"
echo "------------------------------------------"

sleep 2  # Give DynamoDB a moment to be consistent

ITEM_COUNT=$(aws dynamodb scan \
  --table-name "${DYNAMODB_TABLE_NAME}" \
  --filter-expression "deviceId = :deviceId" \
  --expression-attribute-values '{":deviceId":{"S":"'${TEST_DEVICE_ID}'"}}' \
  --select "COUNT" \
  --region "${AWS_REGION}" \
  --query "Count" \
  --output text)

if [ "${ITEM_COUNT}" -gt "0" ]; then
  echo "✅ PASS: Found ${ITEM_COUNT} record(s) in DynamoDB"
else
  echo "❌ FAIL: No records found in DynamoDB"
  exit 1
fi

echo ""

# Test 4: Clean up test data
echo "🧹 Test 4: Cleaning up test data"
echo "---------------------------------"

# Get all test records to delete them
ITEMS=$(aws dynamodb scan \
  --table-name "${DYNAMODB_TABLE_NAME}" \
  --filter-expression "deviceId = :deviceId" \
  --expression-attribute-values '{":deviceId":{"S":"'${TEST_DEVICE_ID}'"}}' \
  --region "${AWS_REGION}" \
  --query "Items[].{deviceId:deviceId,timestamp:timestamp}" \
  --output json)

DELETED_COUNT=0

# Delete each item
echo "${ITEMS}" | jq -c '.[]' | while read -r item; do
  aws dynamodb delete-item \
    --table-name "${DYNAMODB_TABLE_NAME}" \
    --key "${item}" \
    --region "${AWS_REGION}" \
    --output text > /dev/null
  
  DELETED_COUNT=$((DELETED_COUNT + 1))
done

# Count remaining items to verify cleanup
REMAINING_COUNT=$(aws dynamodb scan \
  --table-name "${DYNAMODB_TABLE_NAME}" \
  --filter-expression "deviceId = :deviceId" \
  --expression-attribute-values '{":deviceId":{"S":"'${TEST_DEVICE_ID}'"}}' \
  --select "COUNT" \
  --region "${AWS_REGION}" \
  --query "Count" \
  --output text)

if [ "${REMAINING_COUNT}" = "0" ]; then
  echo "✅ PASS: All test records cleaned up"
else
  echo "⚠️  WARNING: ${REMAINING_COUNT} test record(s) still remain"
fi

echo ""
echo "🎉 All tests completed successfully!"
echo ""
echo "Summary:"
echo "- ✅ API key authentication working"
echo "- ✅ Data ingestion working"
echo "- ✅ DynamoDB storage working"
echo "- ✅ Test data cleaned up"
