const serverless = require('serverless-http');
const express = require('express');
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");

const app = express();

console.log('🚀 Starting Air Monitor Dashboard Lambda...');
console.log('📊 Environment variables:');
console.log('   NODE_ENV:', process.env.NODE_ENV || 'production');
console.log('   AWS_REGION:', process.env.AWS_REGION || 'us-east-1');
console.log('   DYNAMODB_TABLE_NAME:', process.env.DYNAMODB_TABLE_NAME || 'air-monitor-readings');

// AWS DynamoDB setup
console.log('🔧 Setting up DynamoDB client...');
let client, docClient, TABLE_NAME;

try {
  client = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
  });
  docClient = DynamoDBDocumentClient.from(client);
  TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'air-monitor-readings';
  console.log('✅ DynamoDB client initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize DynamoDB client:', error);
}

// Helper function to get recent readings
async function getRecentReadings(hours = 24, deviceId = null) {
  try {
    const now = Date.now();
    const hoursAgo = now - (hours * 60 * 60 * 1000);

    let params;

    if (deviceId) {
      // Query specific device
      params = {
        TableName: TABLE_NAME,
        KeyConditionExpression: 'deviceId = :deviceId AND #ts >= :timestamp',
        ExpressionAttributeNames: {
          '#ts': 'timestamp'
        },
        ExpressionAttributeValues: {
          ':deviceId': deviceId,
          ':timestamp': hoursAgo
        },
        ScanIndexForward: false, // Most recent first
        Limit: 1000
      };

      const command = new QueryCommand(params);
      const result = await docClient.send(command);
      return result.Items || [];
    } else {
      // Scan all devices (less efficient but works for small datasets)
      params = {
        TableName: TABLE_NAME,
        FilterExpression: '#ts >= :timestamp',
        ExpressionAttributeNames: {
          '#ts': 'timestamp'
        },
        ExpressionAttributeValues: {
          ':timestamp': hoursAgo
        }
      };

      const command = new ScanCommand(params);
      const result = await docClient.send(command);
      return (result.Items || []).sort((a, b) => b.timestamp - a.timestamp);
    }
  } catch (error) {
    console.error('Error fetching readings:', error);
    return [];
  }
}

// Helper function to get unique device IDs
async function getDeviceIds() {
  try {
    const params = {
      TableName: TABLE_NAME,
      ProjectionExpression: 'deviceId'
    };

    const command = new ScanCommand(params);
    const result = await docClient.send(command);

    const deviceIds = [...new Set((result.Items || []).map(item => item.deviceId))];
    return deviceIds.sort();
  } catch (error) {
    console.error('Error fetching device IDs:', error);
    return [];
  }
}

// Health check route
app.get('/health', async (req, res) => {
  console.log('🩺 Health check requested');

  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Air Monitor Dashboard is healthy!',
    path: req.path,
    table: TABLE_NAME,
    environment: process.env.NODE_ENV || 'production'
  };

  // Test DynamoDB connection
  if (docClient) {
    try {
      console.log('🔍 Testing DynamoDB connection...');
      const params = {
        TableName: TABLE_NAME,
        ProjectionExpression: 'deviceId',
        Limit: 1
      };

      const command = new ScanCommand(params);
      await docClient.send(command);

      health.dynamodb = 'connected';
      console.log('✅ DynamoDB connection test passed');
    } catch (error) {
      console.error('❌ DynamoDB connection test failed:', error.message);
      health.dynamodb = `error: ${error.message}`;
      health.status = 'degraded';
    }
  } else {
    health.dynamodb = 'not initialized';
    health.status = 'degraded';
  }

  console.log('🩺 Health check result:', health.status);
  res.status(200).json(health);
});

// Main dashboard route
app.get('/', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const deviceId = req.query.device || null;

    const [readings, deviceIds] = await Promise.all([
      getRecentReadings(hours, deviceId),
      getDeviceIds()
    ]);

    // Generate HTML with embedded data
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Air Monitor Dashboard</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            text-align: center;
            margin-bottom: 30px;
        }
        .filters {
            display: flex;
            gap: 20px;
            margin-bottom: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 6px;
        }
        .filter-group {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        .filter-group label {
            font-weight: 500;
            color: #555;
        }
        select, input {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            text-align: center;
        }
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #007bff;
        }
        .stat-label {
            color: #666;
            margin-top: 5px;
        }
        .charts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .chart-container {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .chart-container h3 {
            margin: 0 0 15px 0;
            color: #333;
            font-size: 1.1em;
        }
        .chart-container canvas {
            max-height: 300px;
        }
        .no-data {
            text-align: center;
            color: #666;
            font-style: italic;
            padding: 40px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🌬️ Air Monitor Dashboard</h1>

        <div class="filters">
            <div class="filter-group">
                <label for="hours">Time Range:</label>
                <select id="hours" onchange="updateFilters()">
                    <option value="1" ${hours === 1 ? 'selected' : ''}>Last Hour</option>
                    <option value="6" ${hours === 6 ? 'selected' : ''}>Last 6 Hours</option>
                    <option value="24" ${hours === 24 ? 'selected' : ''}>Last 24 Hours</option>
                    <option value="168" ${hours === 168 ? 'selected' : ''}>Last Week</option>
                </select>
            </div>
            <div class="filter-group">
                <label for="device">Device:</label>
                <select id="device" onchange="updateFilters()">
                    <option value="">All Devices</option>
                    ${deviceIds.map(id => `<option value="${id}" ${deviceId === id ? 'selected' : ''}>${id}</option>`).join('')}
                </select>
            </div>
        </div>

        ${readings.length > 0 ? `
        <div class="stats">
            <div class="stat-card">
                <div class="stat-value">${readings.length}</div>
                <div class="stat-label">Total Readings</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${deviceIds.length}</div>
                <div class="stat-label">Active Devices</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${readings[0] ? new Date(readings[0].timestamp).toLocaleString() : 'N/A'}</div>
                <div class="stat-label">Latest Reading</div>
            </div>
        </div>

        <div class="charts-grid">
            <div class="chart-container">
                <h3>Temperature (°C)</h3>
                <canvas id="temperatureChart"></canvas>
            </div>
            <div class="chart-container">
                <h3>Humidity (%)</h3>
                <canvas id="humidityChart"></canvas>
            </div>
            <div class="chart-container">
                <h3>CO₂ (ppm)</h3>
                <canvas id="co2Chart"></canvas>
            </div>
            <div class="chart-container">
                <h3>TVOC (ppb)</h3>
                <canvas id="tvocChart"></canvas>
            </div>
            <div class="chart-container">
                <h3>eCO₂ (ppm)</h3>
                <canvas id="eco2Chart"></canvas>
            </div>
            <div class="chart-container">
                <h3>PM1.0 (μg/m³)</h3>
                <canvas id="mc1p0Chart"></canvas>
            </div>
            <div class="chart-container">
                <h3>PM2.5 (μg/m³)</h3>
                <canvas id="mc2p5Chart"></canvas>
            </div>
            <div class="chart-container">
                <h3>PM4.0 (μg/m³)</h3>
                <canvas id="mc4p0Chart"></canvas>
            </div>
            <div class="chart-container">
                <h3>PM10.0 (μg/m³)</h3>
                <canvas id="mc10p0Chart"></canvas>
            </div>
            <div class="chart-container">
                <h3>Particle Count 0.5μm (#/cm³)</h3>
                <canvas id="nc0p5Chart"></canvas>
            </div>
            <div class="chart-container">
                <h3>Particle Count 1.0μm (#/cm³)</h3>
                <canvas id="nc1p0Chart"></canvas>
            </div>
            <div class="chart-container">
                <h3>Particle Count 2.5μm (#/cm³)</h3>
                <canvas id="nc2p5Chart"></canvas>
            </div>
            <div class="chart-container">
                <h3>Particle Count 4.0μm (#/cm³)</h3>
                <canvas id="nc4p0Chart"></canvas>
            </div>
            <div class="chart-container">
                <h3>Particle Count 10.0μm (#/cm³)</h3>
                <canvas id="nc10p0Chart"></canvas>
            </div>
            <div class="chart-container">
                <h3>Typical Particle Size (nm)</h3>
                <canvas id="typicalParticleSizeChart"></canvas>
            </div>
        </div>
        ` : `
        <div class="no-data">
            <h3>No data found</h3>
            <p>No readings found for the selected time range and device filter.</p>
            <p>Make sure your ESP32 devices are connected and sending data.</p>
        </div>
        `}
    </div>

    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns"></script>
    <script>
        // Embedded data from server
        const readings = ${JSON.stringify(readings)};

        function updateFilters() {
            const hours = document.getElementById('hours').value;
            const device = document.getElementById('device').value;

            const params = new URLSearchParams();
            if (hours) params.set('hours', hours);
            if (device) params.set('device', device);

            window.location.href = '/?' + params.toString();
        }

        // Prepare data for charts
        function prepareChartData(field, label, color) {
            const deviceData = {};

            readings.forEach(reading => {
                if (!deviceData[reading.deviceId]) {
                    deviceData[reading.deviceId] = [];
                }
                if (reading[field] !== undefined && reading[field] !== null) {
                    deviceData[reading.deviceId].push({
                        x: new Date(reading.timestamp),
                        y: reading[field]
                    });
                }
            });

            // Sort by timestamp
            Object.keys(deviceData).forEach(deviceId => {
                deviceData[deviceId].sort((a, b) => a.x - b.x);
            });

            const colors = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#6f42c1', '#20c997'];
            let colorIndex = 0;

            return Object.keys(deviceData).map(deviceId => ({
                label: deviceId,
                data: deviceData[deviceId],
                borderColor: colors[colorIndex % colors.length],
                backgroundColor: colors[colorIndex++ % colors.length] + '20',
                fill: false,
                tension: 0.1
            }));
        }

        // Create charts
        function createChart(canvasId, field, label, unit) {
            const ctx = document.getElementById(canvasId);
            if (!ctx) return;

            const datasets = prepareChartData(field, label, '#007bff');

            new Chart(ctx, {
                type: 'line',
                data: { datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                displayFormats: {
                                    minute: 'HH:mm',
                                    hour: 'MMM dd HH:mm'
                                }
                            },
                            title: {
                                display: true,
                                text: 'Time'
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: label + (unit ? ' (' + unit + ')' : '')
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        }
                    }
                }
            });
        }

        // Initialize charts when page loads
        document.addEventListener('DOMContentLoaded', function() {
            if (readings.length > 0) {
                createChart('temperatureChart', 'temperature', 'Temperature', '°C');
                createChart('humidityChart', 'humidity', 'Humidity', '%');
                createChart('co2Chart', 'co2', 'CO₂', 'ppm');
                createChart('tvocChart', 'tvoc', 'TVOC', 'ppb');
                createChart('eco2Chart', 'eco2', 'eCO₂', 'ppm');
                createChart('mc1p0Chart', 'mc1p0', 'PM1.0', 'μg/m³');
                createChart('mc2p5Chart', 'mc2p5', 'PM2.5', 'μg/m³');
                createChart('mc4p0Chart', 'mc4p0', 'PM4.0', 'μg/m³');
                createChart('mc10p0Chart', 'mc10p0', 'PM10.0', 'μg/m³');
                createChart('nc0p5Chart', 'nc0p5', 'Particle Count 0.5μm', '#/cm³');
                createChart('nc1p0Chart', 'nc1p0', 'Particle Count 1.0μm', '#/cm³');
                createChart('nc2p5Chart', 'nc2p5', 'Particle Count 2.5μm', '#/cm³');
                createChart('nc4p0Chart', 'nc4p0', 'Particle Count 4.0μm', '#/cm³');
                createChart('nc10p0Chart', 'nc10p0', 'Particle Count 10.0μm', '#/cm³');
                createChart('typicalParticleSizeChart', 'typicalParticleSize', 'Typical Particle Size', 'nm');
            }
        });
    </script>
</body>
</html>`;

    res.send(html);
  } catch (error) {
    console.error('Error rendering dashboard:', error);
    res.status(500).send('Error loading dashboard');
  }
});

// API endpoint for raw data
app.get('/api/readings', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const deviceId = req.query.device || null;

    const readings = await getRecentReadings(hours, deviceId);
    res.json({ readings, count: readings.length });
  } catch (error) {
    console.error('Error fetching readings:', error);
    res.status(500).json({ error: 'Failed to fetch readings' });
  }
});

// Export for Lambda
module.exports.handler = serverless(app);