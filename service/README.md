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

### `./status.sh`
Shows current deployment status and resource information including API endpoint URLs.

### `./cleanup.sh`
**⚠️ DESTRUCTIVE**: Removes all air monitor resources from AWS. Use with caution!

## API Endpoints

After deployment, you'll have:
- `POST /readings` - Submit sensor data
- `GET /readings` - Retrieve last 24 hours of data

## Usage

1. **Deploy**: `./deploy.sh`
2. **Check status**: `./status.sh`
3. **Test the API**: Use the URLs from status output
4. **Clean up**: `./cleanup.sh` (when done)

## Data Format

Send JSON data to the POST endpoint:
```json
{
  "temperature": 23.5,
  "humidity": 65.2,
  "pm25": 12.1
}
```

All key-value pairs become separate measurements in Timestream with device ID `air-monitor-01`.
