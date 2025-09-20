#!/bin/bash

# Update Lambda Function Script
# Updates the air-monitor-ingest Lambda function with latest code changes

set -e

# Configuration
FUNCTION_NAME="air-monitor-ingest"
REGION="us-east-1"

echo "🔄 Updating Lambda function: ${FUNCTION_NAME}"
echo ""

# Set AWS profile
export AWS_PROFILE=personal

# Navigate to service directory
cd /Users/david.jacka/personal-repos/air-monitor/service

# Install/update dependencies
echo "📦 Installing dependencies..."
npm install --production --silent

# Create new deployment package
echo "📦 Creating deployment package..."
rm -f lambda-ingest.zip
zip -rq lambda-ingest.zip ingest.js package.json node_modules/

# Update Lambda function code
echo "🚀 Updating Lambda function..."
aws lambda update-function-code \
    --function-name ${FUNCTION_NAME} \
    --zip-file fileb://lambda-ingest.zip \
    --region ${REGION} \
    --output text > /dev/null

# Wait for update to complete
echo "⏳ Waiting for update to complete..."
aws lambda wait function-updated \
    --function-name ${FUNCTION_NAME} \
    --region ${REGION}

# Get function info
echo ""
echo "✅ Update complete!"
aws lambda get-function \
    --function-name ${FUNCTION_NAME} \
    --region ${REGION} \
    --query 'Configuration.{Name:FunctionName,LastModified:LastModified,CodeSize:CodeSize,State:State}' \
    --output table

# Clean up
rm -f lambda-ingest.zip

echo ""
echo "🎉 Lambda function updated successfully!"
echo ""
echo "💡 You can test it with:"
echo "curl -X POST https://7xi039s0l2.execute-api.us-east-1.amazonaws.com/prod/readings \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"temperature\":25.0,\"humidity\":60.0,\"pm25\":10.0}'"
