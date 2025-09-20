# ESP32 Air Monitor Setup

## Configuration

1. **Copy the config template:**
   ```bash
   cp config.example.h config.h
   ```

2. **Edit `config.h` with your settings:**
   - Replace `WIFI_SSID` with your WiFi network name
   - Replace `WIFI_PASSWORD` with your WiFi password
   - Change `DEVICE_ID` for each device (e.g., "air-monitor-01", "air-monitor-02")

3. **The `config.h` file is git-ignored** to keep your secrets safe.

## Required Libraries

Install these libraries via Arduino IDE Library Manager:

1. **Adafruit SSD1306** by Adafruit
2. **Adafruit GFX Library** by Adafruit  
3. **Adafruit BusIO** by Adafruit
4. **Sensirion I2C SCD4x** by Sensirion
5. **Adafruit SGP30 Sensor** by Adafruit
6. **Sensirion I2C Sps30** by Sensirion
7. **ArduinoJson** by Benoit Blanchon

## Behavior

- **Display Updates**: Every 2 seconds
- **Data Upload**: Every 5 minutes (configurable in `config.h`)
- **WiFi Reconnection**: Automatic every 30 seconds if disconnected
- **Offline Mode**: Continues sensor readings and display if WiFi fails

## Serial Monitor Output

The device will show:
- WiFi connection status
- Sensor readings every 2 seconds
- Upload success/failure messages
- WiFi reconnection attempts

## Troubleshooting

- **WiFi won't connect**: Check SSID/password in `config.h`
- **Upload fails**: Verify API endpoint and key in `config.h`
- **Sensor errors**: Check I2C wiring and power connections
- **Display blank**: Verify OLED I2C address (usually 0x3C)
