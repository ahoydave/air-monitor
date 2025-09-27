# Air Monitor Project

Complete air quality monitoring system with ESP32 devices, AWS backend, and web dashboard.

## 🏗️ Architecture

- **ESP32 Devices**: Collect air quality data (temperature, humidity, CO₂, TVOC, PM2.5)
- **AWS Lambda**: Backend service for data ingestion
- **Amazon DynamoDB**: NoSQL database for sensor readings
- **API Gateway**: REST API endpoints with authentication
- **Lambda Dashboard**: Real-time web interface deployed via Function URL

## 📁 Project Structure

```
air-monitor/
├── air_monitor/        # ESP32 device code
├── service/           # AWS Lambda backend
├── frontend/          # Web dashboard
└── README.md         # This file
```

## 🔧 ESP32 Device Setup

### Hardware Requirements
- **ESP32 Development Board**
- **Sensirion SPS30** (Particulate Matter) - **5V power required**
- **Sensirion SCD41** (CO₂, Temperature, Humidity) - 3.3V
- **Adafruit SGP30** (TVOC, eCO₂) - 3.3V
- **I2C OLED Display** (SSD1306, 128x64) - 3.3V

### Wiring
All sensors use I2C (ESP32 default pins):
- **SDA**: GPIO 21
- **SCL**: GPIO 22
- **Most sensors**: 3.3V power
- **SPS30 only**: 5V power (VIN/VUSB on ESP32)

### Required Libraries
Install via Arduino IDE Library Manager:
1. **Adafruit SSD1306** by Adafruit
2. **Adafruit GFX Library** by Adafruit
3. **Adafruit BusIO** by Adafruit
4. **Sensirion I2C SCD4x** by Sensirion
5. **Adafruit SGP30 Sensor** by Adafruit
6. **Sensirion I2C Sps30** by Sensirion
7. **ArduinoJson** by Benoit Blanchon

### Configuration
1. **Copy config template:**
   ```bash
   cd air_monitor/
   cp config.example.h config.h
   ```

2. **Edit `config.h` with your settings:**
   - WiFi SSID and password
   - API endpoint and key (from backend setup)
   - Unique device ID for each ESP32

3. **Upload sketch** to ESP32

### Device Behavior
- **Display Updates**: Every 2 seconds
- **Data Upload**: Every 5 minutes (configurable)
- **WiFi Reconnection**: Automatic if disconnected
- **Offline Mode**: Continues readings if WiFi fails

### Troubleshooting
- **WiFi issues**: Check SSID/password in `config.h`
- **Upload fails**: Verify API endpoint and key
- **Sensor errors**: Check I2C wiring and power (5V for SPS30!)
- **Display blank**: Verify OLED I2C address (usually 0x3C)

## 🚀 Quick Start

### Backend Service

Located in `service/` directory:

1. **Copy config template**: `cp config.example.sh config.sh`
2. **Edit `config.sh`** with your actual API keys and settings
3. **Test the API**: `./test-api.sh`
4. **Update Lambda**: `./update-lambda.sh`

**API Endpoint**: `https://7xi039s0l2.execute-api.us-east-1.amazonaws.com/prod/readings`

### Frontend Dashboard

Located in `frontend/` directory:

1. **Install dependencies**: `npm install`
2. **Deploy to AWS**: `./deploy.sh`

**Live Dashboard**: https://rvvmpg3lroorsalecnrbr3tyyu0bogsv.lambda-url.us-east-1.on.aws/

## 📡 API Reference

### Submit Sensor Data
**POST** `/readings`
- **Authentication**: API key via `x-api-key` header
- **Content-Type**: `application/json`

```json
{
  "deviceId": "air-monitor-01",
  "temperature": 23.5,
  "humidity": 65.2,
  "co2": 450,
  "tvoc": 125,
  "mc2p5": 12.1
}
```

### Dashboard Endpoints
- **`GET /`** - Main dashboard (HTML)
- **`GET /api/readings`** - Raw data (JSON)
  - Query params: `hours` (1-168), `device` (device ID)
- **`GET /health`** - Health check

## 🌐 Frontend Features

- **Interactive Charts**: Real-time visualization for all sensor types
- **Time Filtering**: View data from 1 hour to 1 week
- **Device Filtering**: Filter by specific device ID
- **Responsive Design**: Works on desktop and mobile
- **Real-time Data**: Direct DynamoDB integration
- **Server-side Rendering**: No complex build process

## 🔧 Development

### Backend
```bash
cd service/
./update-lambda.sh    # Deploy changes
./test-api.sh         # Test functionality
```

### Frontend
```bash
cd frontend/
npm run dev          # Local development
./deploy.sh          # Deploy to AWS
```

## 📊 Data Storage

All sensor readings are stored in DynamoDB with:
- **Primary Key**: `deviceId` (partition key) + `timestamp` (sort key)
- **Attributes**: temperature, humidity, co2, tvoc, pm25
- **TTL**: Optional data retention policies
- **Cost-effective**: Pay only for what you use

## 🏷️ Resource Tagging

All AWS resources are tagged with `Project=air-monitor` for easy management and cost tracking.

## 🔐 Security

- **API Authentication**: Required API key for data submission
- **Resource-based Policies**: Lambda Function URLs with proper permissions
- **Environment Variables**: Secrets managed via AWS configuration
- **Git Ignored Configs**: Sensitive files excluded from version control

## 📈 Monitoring

- **Health Checks**: Built-in health endpoints
- **CloudWatch Logs**: Automatic logging for debugging
- **DynamoDB Metrics**: Built-in AWS monitoring
- **Function Metrics**: Lambda execution and performance data

## 🔄 Deployment

Both services use simple deployment scripts:
- **Backend**: `./update-lambda.sh` (service/)
- **Frontend**: `./deploy.sh` (frontend/)

No complex CI/CD required - just run the scripts to deploy changes.