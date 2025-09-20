#!/bin/bash
# Service Configuration Template
# Copy this file to config.sh and fill in your actual values
# config.sh is git-ignored to keep your secrets safe

# AWS Configuration
export AWS_PROFILE="personal"
export AWS_REGION="us-east-1"

# API Configuration
export API_ENDPOINT="https://7xi039s0l2.execute-api.us-east-1.amazonaws.com/prod/readings"
export API_KEY="DowAeir7KX4p2aGFBh1NK9p81AAaNYtxaPIbUXOP"

# DynamoDB Configuration
export DYNAMODB_TABLE_NAME="air-monitor-readings"

# Test Configuration
export TEST_DEVICE_ID="air-monitor-test"
