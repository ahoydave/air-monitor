// Air Monitor Configuration Template
// Copy this file to config.h and fill in your actual values
// config.h is git-ignored to keep your secrets safe

#ifndef CONFIG_H
#define CONFIG_H

// WiFi Configuration
#define WIFI_SSID "Your_WiFi_Network_Name"
#define WIFI_PASSWORD "Your_WiFi_Password"

// Device Configuration
#define DEVICE_ID "air-monitor-01"  // Change for each device: 01, 02, 03, etc.

// API Configuration
#define API_ENDPOINT "https://7xi039s0l2.execute-api.us-east-1.amazonaws.com/prod/readings"
#define API_KEY "DowAeir7KX4p2aGFBh1NK9p81AAaNYtxaPIbUXOP"

// Timing Configuration
#define READING_INTERVAL_MS 300000  // 5 minutes = 300,000 ms
#define WIFI_TIMEOUT_MS 10000       // 10 seconds
#define HTTP_TIMEOUT_MS 5000        // 5 seconds

#endif
