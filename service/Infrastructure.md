# Air Monitor Infrastructure

## Overview

Simple, cost-effective backend for collecting air quality sensor data from ~6 devices.

## Architecture

- **DynamoDB**: NoSQL database for sensor readings
- **Lambda**: Serverless functions for data processing
- **API Gateway**: REST endpoints for data ingestion
- **IAM**: Security roles and policies

## Components

### DynamoDB Table: `air-monitor-readings`
- **Partition Key**: `deviceId` (String)
- **Sort Key**: `timestamp` (Number) - Unix timestamp in milliseconds
- **Billing**: On-demand (pay per request)

**Data Structure**:
```json
{
  "deviceId": "air-monitor-01",
  "timestamp": 1640995200000,
  "temperature": 23.5,
  "humidity": 65.2,
  "pm25": 12.1,
  "co2": 450,
  "tvoc": 125
}
```

### Lambda Function: `air-monitor-ingest`
- **Runtime**: Node.js 22.x
- **Handler**: `ingest.handler`
- **Environment**: `DYNAMODB_TABLE_NAME=air-monitor-readings`
- **Permissions**: DynamoDB PutItem

### API Gateway: `air-monitor-api`
- **Endpoint**: `POST /readings` → ingest function
- **URL**: `https://7xi039s0l2.execute-api.us-east-1.amazonaws.com/prod/readings`

### IAM Role: `air-monitor-lambda-role`
- **Policies**: Lambda execution + DynamoDB access

## Deployment

All resources created via AWS CLI with consistent tagging:
- `Project=air-monitor`
- `ManagedBy=cli`

## Cost Estimate

**~$3/month** for 6 devices with 5-minute intervals:
- DynamoDB: ~$2
- Lambda: ~$0.20  
- API Gateway: ~$0.50
