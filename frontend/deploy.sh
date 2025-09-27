#!/bin/bash

# Air Monitor Frontend Deployment Script
# Deploys the Express.js app to AWS Lambda with Function URL

set -e  # Exit on any error

echo "🚀 Starting deployment of Air Monitor Frontend..."

# Configuration
FUNCTION_NAME="air-monitor-frontend"
REGION="us-east-1"
PROFILE="personal"
ZIP_FILE="air-monitor-frontend-deployment.zip"

# Clean up old deployment files
echo "🧹 Cleaning up old deployment files..."
rm -f $ZIP_FILE

# Create deployment package
echo "📦 Creating deployment package..."
zip -r $ZIP_FILE . -x \
  "*.git*" \
  "node_modules/.cache/*" \
  "*.log" \
  "deploy.sh" \
  "README.md" \
  "Dockerfile" \
  ".dockerignore" \
  "apprunner.yaml" \
  "$ZIP_FILE"

# Check if function exists
echo "🔍 Checking if Lambda function exists..."
if aws lambda get-function --function-name $FUNCTION_NAME --profile $PROFILE --region $REGION >/dev/null 2>&1; then
    echo "⚡ Updating existing Lambda function..."
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://$ZIP_FILE \
        --profile $PROFILE \
        --region $REGION

    echo "⏳ Waiting for function to be updated..."
    aws lambda wait function-updated \
        --function-name $FUNCTION_NAME \
        --profile $PROFILE \
        --region $REGION
else
    echo "❌ Lambda function does not exist. Please create it first with the initial deployment commands."
    exit 1
fi

# Get the function URL
echo "🌐 Getting Function URL..."
FUNCTION_URL=$(aws lambda get-function-url-config \
    --function-name $FUNCTION_NAME \
    --profile $PROFILE \
    --region $REGION \
    --query 'FunctionUrl' \
    --output text 2>/dev/null || echo "")

if [ -z "$FUNCTION_URL" ]; then
    echo "❌ No Function URL found. The function may not be properly configured."
    exit 1
fi

# Test the deployment
echo "🧪 Testing deployment..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FUNCTION_URL/health")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Deployment successful!"
    echo ""
    echo "🌬️  Air Monitor Dashboard is now live at:"
    echo "   $FUNCTION_URL"
    echo ""
    echo "🩺 Health check: $FUNCTION_URL/health"
    echo "📊 API endpoint: $FUNCTION_URL/api/readings"
    echo ""
    echo "🎉 Deployment complete!"
else
    echo "❌ Deployment test failed. HTTP status: $HTTP_STATUS"
    echo "Check the CloudWatch logs for more details:"
    echo "aws logs tail /aws/lambda/$FUNCTION_NAME --follow --profile $PROFILE"
    exit 1
fi

# Clean up
echo "🧹 Cleaning up deployment package..."
rm -f $ZIP_FILE

echo "✨ All done!"