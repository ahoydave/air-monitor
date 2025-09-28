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

# Test the deployment with retry loop
echo "🧪 Testing deployment..."
echo "⏳ Waiting for Lambda function to be ready (this may take a few seconds)..."
echo "💡 Press Ctrl+C if you want to skip the test and assume success"

RETRY_COUNT=0
MAX_RETRIES=12  # 12 retries = up to 60 seconds
RETRY_DELAY=5   # 5 seconds between retries

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FUNCTION_URL/health" 2>/dev/null)

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
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            echo "⏳ Function not ready yet (attempt $RETRY_COUNT/$MAX_RETRIES, status: $HTTP_STATUS), retrying in ${RETRY_DELAY}s..."
            sleep $RETRY_DELAY
        else
            echo "⚠️  Function still not responding after $MAX_RETRIES attempts"
            echo "📋 Final status: $HTTP_STATUS"
            echo ""
            echo "🌬️  Dashboard should still be available at:"
            echo "   $FUNCTION_URL"
            echo ""
            echo "💡 Try accessing it directly - Lambda functions sometimes take longer to warm up"
            echo "🔍 Check logs if needed: aws logs tail /aws/lambda/$FUNCTION_NAME --follow --profile $PROFILE"
            break
        fi
    fi
done

# Clean up
echo "🧹 Cleaning up deployment package..."
rm -f $ZIP_FILE

echo "✨ All done!"