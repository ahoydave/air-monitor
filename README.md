# Air Monitor

ESP32 air quality monitoring system with AWS backend and web dashboard.

**Live Dashboard**: https://rvvmpg3lroorsalecnrbr3tyyu0bogsv.lambda-url.us-east-1.on.aws/

## Device Setup

**Hardware**: ESP32 + Sensirion SPS30 (PM2.5) + SCD41 (CO₂/temp/humidity) + SGP30 (TVOC) + OLED display

**Libraries** (Arduino IDE):
- Adafruit SSD1306, GFX Library, BusIO
- Sensirion I2C SCD4x, Sensirion I2C Sps30  
- Adafruit SGP30 Sensor
- ArduinoJson

**Setup**:
```bash
cd air_monitor/
cp config.example.h config.h
# Edit config.h with WiFi credentials and API details
# Upload to ESP32
```

## Backend

**Setup**:
```bash
cd service/
cp config.example.sh config.sh
# Edit config.sh with AWS credentials
./update-lambda.sh
```

**API**: `POST /readings` with `x-api-key` header

## Frontend

**Setup**:
```bash
cd frontend/
npm install
./deploy.sh
```

Real-time dashboard with interactive charts, time filtering, and device selection.