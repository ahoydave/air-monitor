/******************************************************************************
 * ESP32 Air Quality Monitor
 * * Reads data from:
 * - Sensirion SPS30 (Particulate Matter)
 * - Sensirion SCD41 (CO2, Temperature, Humidity)
 * - Adafruit SGP30 (TVOC, eCO2)
 * * Displays data on:
 * - I2C OLED Display (SSD1306)
 * - Serial Monitor
 *
 * WIRING:
 * All sensors are I2C. You can connect them to the same I2C pins on the ESP32.
 * Default ESP32 I2C pins are:
 * - SDA: GPIO 21
 * - SCL: GPIO 22
 * * Connect all sensor and display modules:
 * - VCC/VIN to 3.3V on ESP32 (EXCEPT for the SPS30)
 * - GND to GND on ESP32
 * - SDA to GPIO 21 on ESP32
 * - SCL to GPIO 22 on ESP32
 *
 * SPECIAL WIRING FOR SPS30:
 * - VDD (VIN) of SPS30 MUST connect to 5V (VIN/VUSB) on the ESP32.
 * - GND to GND
 * - SDA to GPIO 21
 * - SCL to GPIO 22
 * * LIBRARIES TO INSTALL via Arduino Library Manager:
 * 1. "Adafruit SSD1306" by Adafruit
 * 2. "Adafruit GFX Library" by Adafruit
 * 3. "Adafruit BusIO" by Adafruit
 * 4. "Sensirion I2C SCD4x" by Sensirion
 * 5. "Adafruit SGP30 Sensor" by Adafruit
 * 6. "Sensirion I2C Sps30" by Sensirion
 * 7. "ArduinoJson" by Benoit Blanchon
 * ******************************************************************************/

#include <Wire.h>
#include <SensirionI2cScd4x.h>
#include <Adafruit_SGP30.h>
#include <SensirionI2cSps30.h>

#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#include "config.h"

// OLED Display settings
#define SCREEN_WIDTH 128 // OLED display width, in pixels
#define SCREEN_HEIGHT 64 // OLED display height, in pixels
#define TEXT_HEIGHT 9
#define OLED_RESET    -1 // Reset pin # (or -1 if sharing Arduino reset pin)
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// Sensor objects
SensirionI2cScd4x scd4x;
Adafruit_SGP30 sgp30;
SensirionI2cSps30 sps30;

// Variables to hold sensor data
uint16_t co2 = 0;

float temperature = 0.0f;

float humidity = 0.0f;

uint16_t tvoc = 0;

uint16_t eco2 = 0;

static int16_t error;
static char errorMessage[64];
uint16_t dataReadyFlag = 0;
uint16_t mc1p0 = 0;
uint16_t mc2p5 = 0;
uint16_t mc4p0 = 0;
uint16_t mc10p0 = 0;
uint16_t nc0p5 = 0;
uint16_t nc1p0 = 0;
uint16_t nc2p5 = 0;
uint16_t nc4p0 = 0;
uint16_t nc10p0 = 0;
uint16_t typicalParticleSize = 0;

// Timer for non-blocking readings and uploads
unsigned long lastReadingTime = 0;
unsigned long lastUploadTime = 0;
const long displayInterval = 2000; // Update display every 2 seconds

// WiFi and HTTP status
bool wifiConnected = false;
HTTPClient http;

void setup() {
  Serial.begin(115200);
  while (!Serial) {
    delay(100); // Wait for serial connection
  }
  Serial.println("\n\n--- Air Monitor Booting Up ---");

  Wire.begin(); // Initialize I2C bus

  // --- Initialize OLED Display ---
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { // Address 0x3C for 128x64
    Serial.println(F("SSD1306 allocation failed. Check wiring."));
    for(;;); // Don't proceed, loop forever
  }
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Air Monitor Starting...");
  display.display();
  Serial.println("OLED Display Initialized.");

  // --- Initialize SGP30 Sensor ---
  Serial.println("Initializing SGP30...");
  if (!sgp30.begin()){
    Serial.println("SGP30 sensor not found!");
    displayMessage("Error: SGP30\nNot Found");
    while (1);
  }
  Serial.println("SGP30 sensor found.");

  // --- Initialize SCD41 Sensor ---
  Serial.println("Initializing SCD41...");
  scd4x.begin(Wire, 0x62); // Pass the I2C bus AND the sensor's address
  scd4x.stopPeriodicMeasurement();
  scd4x.startPeriodicMeasurement();
  Serial.println("Waiting for SCD41 initial measurements...");

  // --- Initialize SPS30 Sensor ---
  Serial.println("Initializing SPS30...");
  sps30.begin(Wire, SPS30_I2C_ADDR_69);
  sps30.stopMeasurement();
  int8_t serialNumber[32] = {0};
  int8_t productType[8] = {0};
  sps30.readSerialNumber(serialNumber, 32);
  sps30.readProductType(productType, 8);
  sps30.startMeasurement((SPS30OutputFormat)(1280));

  // --- Initialize WiFi ---
  Serial.println("Connecting to WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  unsigned long wifiStart = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - wifiStart < WIFI_TIMEOUT_MS) {
    delay(500);
    Serial.print(".");
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println("");
    Serial.println("WiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    displayMessage("WiFi Connected!\n" + WiFi.localIP().toString());
    delay(2000);
  } else {
    Serial.println("");
    Serial.println("WiFi connection failed!");
    displayMessage("WiFi Failed!\nContinuing offline");
    delay(2000);
  }

  lastReadingTime = millis();
  lastUploadTime = millis();
}

void loop() {
  // Update sensor readings and display every 2 seconds
  if (millis() - lastReadingTime > displayInterval) {
    lastReadingTime = millis();

    readSCD41();
    readSGP30();
    readSPS30();

    printToSerial();
    updateDisplay();
  }

  // Upload data every 5 minutes (or configured interval)
  if (wifiConnected && millis() - lastUploadTime > READING_INTERVAL_MS) {
    lastUploadTime = millis();
    uploadSensorData();
  }

  // Check WiFi connection periodically
  if (millis() % 30000 == 0) { // Every 30 seconds
    checkWiFiConnection();
  }
}

void readSCD41() {
  uint16_t error;
  bool isDataReady = false;

  // Check if the sensor has new data available
  error = scd4x.getDataReadyStatus(isDataReady);
  if (error) {
    Serial.print("Error checking SCD41 data ready status. Error code: ");
    Serial.println(error);
    return;
  }

  if (isDataReady) {
    // If data is ready, read the measurement
    error = scd4x.readMeasurement(co2, temperature, humidity);
    if (error) {
      Serial.print("Error reading SCD41 measurement. Error code: ");
      Serial.println(error);
      co2 = 0; temperature = 0; humidity = 0;
    } else if (co2 == 0) {
      Serial.println("SCD41: Invalid data received.");
    }
  }
  // If data is not ready, we simply do nothing and wait for the next loop.
}

void readSGP30() {
    // Read SGP30 measurement
    if (!sgp30.IAQmeasure()) {
        Serial.println("SGP30 measurement failed");
        tvoc = 0; eco2 = 0;
        return;
    }
    tvoc = sgp30.TVOC;
    eco2 = sgp30.eCO2;
}

void readSPS30() {
  dataReadyFlag = 0;

  error = sps30.readDataReadyFlag(dataReadyFlag);
  if (error != 0) {
    Serial.print("Error trying to execute readDataReadyFlag(): ");
    errorToString(error, errorMessage, sizeof errorMessage);
    Serial.println(errorMessage);
    return;
  }
  Serial.print("dataReadyFlag: ");
  Serial.print(dataReadyFlag);
  Serial.println();
  error = sps30.readMeasurementValuesUint16(mc1p0, mc2p5, mc4p0, mc10p0,
                                             nc0p5, nc1p0, nc2p5, nc4p0,
                                             nc10p0, typicalParticleSize);
  if (error != 0) {
      Serial.print("Error trying to execute readMeasurementValuesUint16(): ");
      errorToString(error, errorMessage, sizeof errorMessage);
      Serial.println(errorMessage);
      return;
  }
}

void printToSerial() {
  Serial.println("---------------------------------");
  Serial.print("CO2: ");
  Serial.print(co2);
  Serial.println(" ppm");

  Serial.print("Temperature: ");
  Serial.print(temperature);
  Serial.println(" *C");

  Serial.print("Humidity: ");
  Serial.print(humidity);
  Serial.println(" %");

  Serial.print("TVOC: ");
  Serial.print(tvoc);
  Serial.println(" ppb");
  
  Serial.print("PM 2.5: ");
  Serial.print(mc2p5);
  Serial.println(" ug/m3");

  Serial.print("PM 4: ");
  Serial.print(mc4p0);
  Serial.println(" ug/m3");

  Serial.print("PM 10: ");
  Serial.print(mc10p0);
  Serial.println(" ug/m3");
  Serial.println("---------------------------------");
}

void updateDisplay() {
  int row = 0;

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  
  // First Column
  display.setCursor(0, row);
  display.print("CO2 ");
  display.print(co2);
  display.print(" ppm");
  
  row += TEXT_HEIGHT;
  display.setCursor(0, row);
  display.print("TVOC: ");
  display.print(tvoc);
  display.print(" ppb");

  row += TEXT_HEIGHT;
  display.setCursor(0, row);
  display.print("T: ");
  display.print(temperature, 1);
  display.print(" C");

  row += TEXT_HEIGHT;
  display.setCursor(0, row);
  display.print("H: ");
  display.print(humidity, 1);
  display.print(" %");
  
  row += TEXT_HEIGHT;
  display.setCursor(0, row);
  display.print("PM2.5: ");
  display.print(mc2p5, 1);
  display.print(" ug/m3");

  row += TEXT_HEIGHT;
  display.setCursor(0, row);
  display.print("PM4: ");
  display.print(mc4p0, 1);
  display.print(" ug/m3");

  row += TEXT_HEIGHT;
  display.setCursor(0, row);
  display.print("PM10: ");
  display.print(mc10p0, 1);
  display.print(" ug/m3");

  display.display();
}

// Helper function to display a message
void displayMessage(String msg) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println(msg);
  display.display();
}

void checkWiFiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    wifiConnected = false;
    Serial.println("WiFi disconnected. Attempting to reconnect...");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    unsigned long reconnectStart = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - reconnectStart < 5000) {
      delay(500);
      Serial.print(".");
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      wifiConnected = true;
      Serial.println("\nWiFi reconnected!");
    } else {
      Serial.println("\nWiFi reconnection failed.");
    }
  }
}

void uploadSensorData() {
  if (!wifiConnected) {
    Serial.println("WiFi not connected. Skipping upload.");
    return;
  }

  Serial.println("Uploading sensor data...");
  
  // Create JSON payload
  DynamicJsonDocument doc(1024);
  doc["deviceId"] = DEVICE_ID;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["co2"] = co2;
  doc["tvoc"] = tvoc;
  doc["eco2"] = eco2;
  doc["mc1p0"] = mc1p0;
  doc["mc2p5"] = mc2p5;
  doc["mc4p0"] = mc4p0;
  doc["mc10p0"] = mc10p0;
  doc["nc0p5"] = nc0p5;
  doc["nc1p0"] = nc1p0;
  doc["nc2p5"] = nc2p5;
  doc["nc4p0"] = nc4p0;
  doc["nc10p0"] = nc10p0;
  doc["typicalParticleSize"] = typicalParticleSize;

  String jsonString;
  serializeJson(doc, jsonString);

  // Send HTTP POST request
  http.begin(API_ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", API_KEY);
  http.setTimeout(HTTP_TIMEOUT_MS);

  int httpResponseCode = http.POST(jsonString);

  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("Upload successful!");
    Serial.print("Response code: ");
    Serial.println(httpResponseCode);
    Serial.print("Response: ");
    Serial.println(response);
    
    // Show success on display briefly
    displayMessage("Upload OK!\nCode: " + String(httpResponseCode));
    delay(1000);
  } else {
    Serial.print("Upload failed. Error code: ");
    Serial.println(httpResponseCode);
    
    // Show error on display briefly
    displayMessage("Upload Failed!\nError: " + String(httpResponseCode));
    delay(1000);
  }

  http.end();
}
