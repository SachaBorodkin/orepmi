#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <HardwareSerial.h>
#include <TinyGPSPlus.h>

#define BATTERY_PIN 1
#define GPS_RX_PIN 44
#define GPS_TX_PIN 43
#define TRACKER_ID 1

struct WifiCredential {
  const char* ssid;
  const char* password;
};

const WifiCredential wifiList[] = {
  {"NorthKoreaMilitaryNetwork", "Sigma_Mobile"},
  {"BackupNetwork_1", "PasswordOne"},
  {"BackupNetwork_2", "PasswordTwo"}
};

const size_t wifiCount = sizeof(wifiList) / sizeof(wifiList[0]);

const char* supabaseUrl = "https://pbgojjsqxjxopfnarzvd.supabase.co/rest/v1/gps_logs";
const char* supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZ29qanNxeGp4b3BmbmFyenZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2NDg0NjYsImV4cCI6MjEwNTIyNDQ2Nn0.JQlU1h5Lx61D1a9DucNkbBz44LpeN95rWCZbfnY7itA";

struct GpsData {
  double lat;
  double lng;
  double speed;
  int sats;
  int charge;
  int trackerId;
};

QueueHandle_t txQueue;
HardwareSerial gpsSerial(1);
TinyGPSPlus gps;

const byte UBX_RATE_5HZ[] = {
  0xB5, 0x62, 0x06, 0x08, 0x06, 0x00, 0xC8, 0x00, 0x01, 0x00, 0x01, 0x00, 0xDE, 0x6A
};

const byte UBX_BAUD_115200[] = {
  0xB5, 0x62, 0x06, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0xD0, 0x08,
  0x00, 0x00, 0x00, 0xC2, 0x01, 0x00, 0x07, 0x00, 0x03, 0x00, 0x00, 0x00,
  0x00, 0x00, 0xC0, 0x7E
};

int readBatteryCharge() {
  uint32_t raw = analogReadMilliVolts(BATTERY_PIN);
  float volts = (raw / 1000.0f) * 2.0f;
  if (volts >= 4.20f) return 100;
  if (volts <= 3.30f) return 0;
  return (int)((volts - 3.30f) / (4.20f - 3.30f) * 100.0f);
}

void configureGpsHighSpeed() {
  gpsSerial.write(UBX_BAUD_115200, sizeof(UBX_BAUD_115200));
  gpsSerial.flush();
  delay(100);
  gpsSerial.updateBaudRate(115200);
  delay(50);
  gpsSerial.write(UBX_RATE_5HZ, sizeof(UBX_RATE_5HZ));
}

void connectToWiFiWithFallback(uint32_t timeoutMs = 30000) {
  size_t currentIdx = 0;

  while (WiFi.status() != WL_CONNECTED) {
    WiFi.disconnect(true);
    delay(100);

    WiFi.begin(wifiList[currentIdx].ssid, wifiList[currentIdx].password);

    uint32_t startAttempt = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < timeoutMs) {
      delay(100);
    }

    if (WiFi.status() != WL_CONNECTED) {
      currentIdx = (currentIdx + 1) % wifiCount;
    }
  }
}

void networkTask(void* pvParameters) {
  WiFiClientSecure client;
  HTTPClient http;
  client.setInsecure();

  GpsData data;
  char payload[192];

  for (;;) {
    if (xQueueReceive(txQueue, &data, portMAX_DELAY) == pdTRUE) {
      if (WiFi.status() != WL_CONNECTED) {
        connectToWiFiWithFallback(30000);
      }

      if (WiFi.status() == WL_CONNECTED) {
        http.begin(client, supabaseUrl);
        http.setReuse(true);
        http.addHeader("Content-Type", "application/json");
        http.addHeader("apikey", supabaseAnonKey);
        http.addHeader("Authorization", String("Bearer ") + supabaseAnonKey);
        http.addHeader("Prefer", "return=minimal");
        http.addHeader("Connection", "keep-alive");

        snprintf(payload, sizeof(payload),
                 "{\"latitude\":%.6f,\"longitude\":%.6f,\"speed\":%.2f,\"satellites\":%d,\"charge\":%d,\"tracker_id\":%d}",
                 data.lat, data.lng, data.speed, data.sats, data.charge, data.trackerId);

        int code = http.POST(reinterpret_cast<uint8_t*>(payload), strlen(payload));
        if (code <= 0) {
          http.end();
        }
      }
    }
  }
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);

  txQueue = xQueueCreate(10, sizeof(GpsData));

  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);

  connectToWiFiWithFallback(30000);

  configureGpsHighSpeed();

  xTaskCreatePinnedToCore(
    networkTask,
    "NetworkTask",
    8192,
    NULL,
    1,
    NULL,
    0
  );
}

void loop() {
  while (gpsSerial.available() > 0) {
    if (gps.encode(gpsSerial.read())) {
      if (gps.location.isUpdated() && gps.location.isValid()) {
        GpsData packet = {
          gps.location.lat(),
          gps.location.lng(),
          gps.speed.kmph(),
          gps.satellites.value(),
          readBatteryCharge(),
          TRACKER_ID
        };

        xQueueSend(txQueue, &packet, 0);
      }
    }
  }
}