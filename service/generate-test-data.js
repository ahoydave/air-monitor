#!/usr/bin/env node

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

// AWS DynamoDB setup
const client = new DynamoDBClient({ 
  region: process.env.AWS_REGION || 'us-east-1',
});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'air-monitor-readings';

// Device configurations with realistic baseline values
const devices = [
  {
    id: 'air-monitor-living-room',
    baselines: {
      temperature: 22.5,
      humidity: 45,
      co2: 450,
      tvoc: 120,
      mc2p5: 8
    },
    variations: {
      temperature: 3,    // ±3°C variation
      humidity: 15,      // ±15% variation
      co2: 200,          // ±200 ppm variation
      tvoc: 80,          // ±80 ppb variation
      mc2p5: 5           // ±5 μg/m³ variation
    }
  },
  {
    id: 'air-monitor-bedroom',
    baselines: {
      temperature: 20.0,
      humidity: 50,
      co2: 380,
      tvoc: 90,
      mc2p5: 6
    },
    variations: {
      temperature: 2.5,
      humidity: 12,
      co2: 150,
      tvoc: 60,
      mc2p5: 4
    }
  },
  {
    id: 'air-monitor-kitchen',
    baselines: {
      temperature: 24.0,
      humidity: 55,
      co2: 520,
      tvoc: 180,
      mc2p5: 12
    },
    variations: {
      temperature: 4,
      humidity: 20,
      co2: 300,
      tvoc: 120,
      mc2p5: 8
    }
  }
];

// Generate realistic sensor reading with daily patterns
function generateReading(device, timestamp) {
  const hour = new Date(timestamp).getHours();
  const dayOfWeek = new Date(timestamp).getDay();
  
  // Daily patterns (morning/evening peaks for CO2, cooking times for kitchen, etc.)
  let timeMultiplier = 1.0;
  
  // Higher activity during day (8am-10pm)
  if (hour >= 8 && hour <= 22) {
    timeMultiplier = 1.2;
  }
  
  // Cooking times (kitchen gets extra activity)
  if (device.id.includes('kitchen') && (
    (hour >= 7 && hour <= 9) ||   // breakfast
    (hour >= 12 && hour <= 14) || // lunch
    (hour >= 18 && hour <= 20)    // dinner
  )) {
    timeMultiplier = 1.5;
  }
  
  // Weekend patterns (slightly different)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    timeMultiplier *= 0.9; // slightly lower on weekends
  }
  
  // Generate readings with some correlation and realistic noise
  const reading = {
    deviceId: device.id,
    timestamp: timestamp,
    temperature: +(device.baselines.temperature + 
      (Math.random() - 0.5) * device.variations.temperature).toFixed(1),
    humidity: Math.max(20, Math.min(80, +(device.baselines.humidity + 
      (Math.random() - 0.5) * device.variations.humidity).toFixed(1))),
    co2: Math.max(300, Math.round(device.baselines.co2 * timeMultiplier + 
      (Math.random() - 0.5) * device.variations.co2)),
    tvoc: Math.max(10, Math.round(device.baselines.tvoc * timeMultiplier + 
      (Math.random() - 0.5) * device.variations.tvoc)),
    mc2p5: Math.max(1, +(device.baselines.mc2p5 * timeMultiplier + 
      (Math.random() - 0.5) * device.variations.mc2p5).toFixed(1))
  };
  
  return reading;
}

async function generateAndInsertData() {
  console.log('🌬️  Generating realistic test data for Air Monitor...');
  console.log(`📊 Target table: ${TABLE_NAME}`);
  console.log(`📅 Generating data for last 5 days`);
  
  const now = Date.now();
  const fiveDaysAgo = now - (5 * 24 * 60 * 60 * 1000);
  
  // Generate data every 15 minutes for the last 5 days
  const readings = [];
  const interval = 15 * 60 * 1000; // 15 minutes in milliseconds
  
  for (let timestamp = fiveDaysAgo; timestamp <= now; timestamp += interval) {
    for (const device of devices) {
      const reading = generateReading(device, timestamp);
      readings.push(reading);
    }
  }
  
  console.log(`📈 Generated ${readings.length} readings for ${devices.length} devices`);
  console.log(`⏱️  Time range: ${new Date(fiveDaysAgo).toLocaleString()} to ${new Date(now).toLocaleString()}`);
  
  // Insert data in batches to avoid overwhelming DynamoDB
  const batchSize = 25; // DynamoDB batch write limit
  let inserted = 0;
  
  for (let i = 0; i < readings.length; i += batchSize) {
    const batch = readings.slice(i, i + batchSize);
    
    // Insert each reading individually (simpler than batch writes)
    for (const reading of batch) {
      try {
        const params = {
          TableName: TABLE_NAME,
          Item: reading
        };
        
        const command = new PutCommand(params);
        await docClient.send(command);
        inserted++;
        
        if (inserted % 100 === 0) {
          console.log(`✅ Inserted ${inserted}/${readings.length} readings...`);
        }
      } catch (error) {
        console.error(`❌ Error inserting reading:`, error);
      }
    }
    
    // Small delay to be nice to DynamoDB
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`🎉 Successfully inserted ${inserted} readings!`);
  console.log(`📊 Dashboard should now show rich data for:`);
  devices.forEach(device => {
    console.log(`   • ${device.id}`);
  });
  console.log(`\n🌐 View your dashboard at: http://localhost:3000`);
}

// Run the script
if (require.main === module) {
  generateAndInsertData().catch(error => {
    console.error('❌ Error generating test data:', error);
    process.exit(1);
  });
}

module.exports = { generateAndInsertData };
