'use strict';

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

module.exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  try {
    const data = JSON.parse(event.body);
    const currentTime = Date.now();

    // Extract deviceId from request body or use default
    const deviceId = data.deviceId || 'air-monitor-01';
    
    // Remove deviceId from sensor data if it exists
    const { deviceId: _, ...sensorData } = data;

    // Validate that we have some sensor data
    if (!sensorData || Object.keys(sensorData).length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "No sensor data provided." }),
      };
    }

    // Create DynamoDB item with all sensor readings in a single record
    const item = {
      deviceId: deviceId,
      timestamp: currentTime,
      ...sensorData // Spread all sensor readings (temperature, humidity, pm25, etc.)
    };

    const params = {
      TableName: process.env.DYNAMODB_TABLE_NAME,
      Item: item
    };

    const command = new PutCommand(params);
    await docClient.send(command);

    console.log('Successfully wrote record to DynamoDB:', { deviceId, timestamp: currentTime });

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Data ingested successfully!',
        deviceId: deviceId,
        timestamp: currentTime
      }),
    };

  } catch (error) {
    console.error('Error ingesting data:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error ingesting data.',
        error: error.message,
      }),
    };
  }
};
