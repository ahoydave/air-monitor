# Air Monitor Backend

Simple AWS CLI-based deployment for the air monitor backend service.

## Architecture

- **AWS Lambda**: Functions for data ingest (and future querying)
- **Amazon DynamoDB**: NoSQL database for sensor readings (cost-effective for small scale)
- **API Gateway**: REST API endpoints
- **Resource Tagging**: All resources tagged with `Project=air-monitor`

## Scripts

### `./update-lambda.sh`
Updates the Lambda function with latest code changes:
- Installs/updates dependencies
- Creates new deployment package
- Updates Lambda function code
- Waits for update completion
- Shows updated function info

### `./test-api.sh`
Tests API security and functionality:
- Tests API without key (should fail with 403)
- Tests API with valid key (should succeed with 200)
- Verifies data is stored in DynamoDB
- Cleans up test data automatically

## Configuration

1. **Copy config template**: `cp config.example.sh config.sh`
2. **Edit `config.sh`** with your actual API keys and settings
3. **The `config.sh` file is git-ignored** to keep secrets safe

## API Endpoints

- `POST /readings` - Submit sensor data (requires API key)
- **Endpoint**: `https://7xi039s0l2.execute-api.us-east-1.amazonaws.com/prod/readings`
- **Authentication**: API key via `x-api-key` header

## Usage

1. **Test the API**: `./test-api.sh`
2. **Update Lambda**: `./update-lambda.sh`
3. **See Infrastructure.md** for detailed setup instructions

## Data Format

Send JSON data with device ID and sensor readings:
```json
{
  "deviceId": "air-monitor-01",
  "temperature": 23.5,
  "humidity": 65.2,
  "co2": 450,
  "tvoc": 125,
  "pm25": 12.1
}
```

All sensor readings are stored in DynamoDB with timestamp and device ID.
