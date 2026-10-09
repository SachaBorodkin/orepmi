#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <HardwareSerial.h>
#include <TinyGPSPlus.h>
#include <FS.h>
#include <LittleFS.h>
#include <esp_wifi.h>

#define BATTERY_PIN 1
#define GPS_RX_PIN 44
#define GPS_TX_PIN 43
#define TRACKER_ID 1

#define BATCH_SIZE 10
#define SPIFFS_LOG_PATH "/gps_buffer.bin"
#define MAX_BUFFERED_RECORDS 200

#define SPEED_THRESHOLD 1.5f
#define DISTANCE_THRESHOLD 8.0f
#define HDOP_MAX_ACCURACY 3.0f

#define MOVING_INTERVAL_MS 2000
#define IDLE_INTERVAL_MS 30000
#define BATTERY_CHECK_INTERVAL_MS 60000

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
volatile size_t currentWifiIdx = 0;
volatile bool wifiConnected = false;

const char* supabaseUrl = "https://pbgojjsqxjxopfnarzvd.supabase.co/rest/v1/gps_logs";
const char* supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZ29qanNxeGp4b3BmbmFyenZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2NDg0NjYsImV4cCI6MjEwNTIyNDQ2Nn0.JQlU1h5Lx61D1a9DucNkbBz44LpeN95rWCZbfnY7itA";

struct GpsData {
  double lat;
  double lng;
  float speed;
  float hdop;
  float altitude;
  float course;
  int sats;
  int charge;
  int trackerId;
  char timestamp[25];
};

QueueHandle_t txQueue;
HardwareSerial gpsSerial(1);
TinyGPSPlus gps;

int cachedBatteryCharge = 100;
uint32_t lastBatteryCheck = 0;
uint32_t lastUploadTime = 0;
double lastLoggedLat = 0.0;
double lastLoggedLng = 0.0;

const byte UBX_RATE_1HZ[] = {
  0xB5, 0x62, 0x06, 0x08, 0x06, 0x00, 0xE8, 0x03, 0x01, 0x00, 0x01, 0x00, 0x01, 0x39
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

void configureGps() {
  gpsSerial.write(UBX_BAUD_115200, sizeof(UBX_BAUD_115200));
  gpsSerial.flush();
  delay(100);
  gpsSerial.updateBaudRate(115200);
  delay(50);
  gpsSerial.write(UBX_RATE_1HZ, sizeof(UBX_RATE_1HZ));
}

void appendToFlash(const GpsData& data) {
  File file = LittleFS.open(SPIFFS_LOG_PATH, FILE_APPEND);
  if (!file) return;
  if (file.size() >= sizeof(GpsData) * MAX_BUFFERED_RECORDS) {
    file.close();
    return;
  }
  file.write(reinterpret_cast<const uint8_t*>(&data), sizeof(GpsData));
  file.close();
}

size_t readFromFlash(GpsData* buffer, size_t maxCount) {
  if (!LittleFS.exists(SPIFFS_LOG_PATH)) return 0;
  File file = LittleFS.open(SPIFFS_LOG_PATH, FILE_READ);
  if (!file) return 0;

  size_t count = 0;
  while (file.available() >= sizeof(GpsData) && count < maxCount) {
    file.read(reinterpret_cast<uint8_t*>(&buffer[count]), sizeof(GpsData));
    count++;
  }

  size_t remainingBytes = file.available();
  uint8_t* remainder = nullptr;
  if (remainingBytes > 0) {
    remainder = (uint8_t*)malloc(remainingBytes);
    if (remainder) {
      file.read(remainder, remainingBytes);
    }
  }
  file.close();

  if (remainingBytes > 0 && remainder) {
    File rewrite = LittleFS.open(SPIFFS_LOG_PATH, FILE_WRITE);
    if (rewrite) {
      rewrite.write(remainder, remainingBytes);
      rewrite.close();
    }
    free(remainder);
  } else {
    LittleFS.remove(SPIFFS_LOG_PATH);
  }

  return count;
}

void onWiFiEvent(WiFiEvent_t event) {
  switch (event) {
    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
      wifiConnected = true;
      break;
    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
      wifiConnected = false;
      currentWifiIdx = (currentWifiIdx + 1) % wifiCount;
      WiFi.begin(wifiList[currentWifiIdx].ssid, wifiList[currentWifiIdx].password);
      break;
    default:
      break;
  }
}

bool postBatchToSupabase(HTTPClient& http, WiFiClientSecure& client, GpsData* records, size_t count) {
  if (count == 0) return true;

  char payload[4096];
  size_t offset = 0;
  offset += snprintf(payload + offset, sizeof(payload) - offset, "[");

  for (size_t i = 0; i < count; i++) {
    bool hasTs = (records[i].timestamp[0] != '\0');
    if (hasTs) {
      offset += snprintf(
        payload + offset,
        sizeof(payload) - offset,
        "{\"created_at\":\"%s\",\"latitude\":%.6f,\"longitude\":%.6f,\"speed\":%.2f,\"satellites\":%d,\"charge\":%d,\"tracker_id\":%d,\"hdop\":%.2f,\"altitude\":%.1f,\"course\":%.1f}%s",
        records[i].timestamp,
        records[i].lat,
        records[i].lng,
        records[i].speed,
        records[i].sats,
        records[i].charge,
        records[i].trackerId,
        records[i].hdop,
        records[i].altitude,
        records[i].course,
        (i == count - 1) ? "" : ","
      );
    } else {
      offset += snprintf(
        payload + offset,
        sizeof(payload) - offset,
        "{\"latitude\":%.6f,\"longitude\":%.6f,\"speed\":%.2f,\"satellites\":%d,\"charge\":%d,\"tracker_id\":%d,\"hdop\":%.2f,\"altitude\":%.1f,\"course\":%.1f}%s",
        records[i].lat,
        records[i].lng,
        records[i].speed,
        records[i].sats,
        records[i].charge,
        records[i].trackerId,
        records[i].hdop,
        records[i].altitude,
        records[i].course,
        (i == count - 1) ? "" : ","
      );
    }
  }
  snprintf(payload + offset, sizeof(payload) - offset, "]");

  http.begin(client, supabaseUrl);
  http.setReuse(true);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", supabaseAnonKey);
  http.addHeader("Authorization", String("Bearer ") + supabaseAnonKey);
  http.addHeader("Prefer", "return=minimal");
  http.addHeader("Connection", "keep-alive");

  int httpCode = http.POST(reinterpret_cast<uint8_t*>(payload), strlen(payload));
  bool success = (httpCode >= 200 && httpCode < 300);
  if (!success) {
    http.end();
  }
  return success;
}

void networkTask(void* pvParameters) {
  WiFiClientSecure client;
  HTTPClient http;
  client.setInsecure();

  GpsData localBatch[BATCH_SIZE];
  size_t batchCount = 0;

  for (;;) {
    GpsData packet;
    if (xQueueReceive(txQueue, &packet, pdMS_TO_TICKS(1000)) == pdTRUE) {
      if (batchCount < BATCH_SIZE) {
        localBatch[batchCount++] = packet;
      } else {
        appendToFlash(packet);
      }
    }

    if (!wifiConnected) {
      if (batchCount > 0) {
        for (size_t i = 0; i < batchCount; i++) {
          appendToFlash(localBatch[i]);
        }
        batchCount = 0;
      }
      vTaskDelay(pdMS_TO_TICKS(500));
      continue;
    }

    if (batchCount >= BATCH_SIZE || (batchCount > 0 && !LittleFS.exists(SPIFFS_LOG_PATH))) {
      if (postBatchToSupabase(http, client, localBatch, batchCount)) {
        batchCount = 0;
      } else {
        for (size_t i = 0; i < batchCount; i++) {
          appendToFlash(localBatch[i]);
        }
        batchCount = 0;
      }
    }

    if (LittleFS.exists(SPIFFS_LOG_PATH)) {
      GpsData offlineBatch[BATCH_SIZE];
      size_t readCount = readFromFlash(offlineBatch, BATCH_SIZE);
      if (readCount > 0) {
        if (!postBatchToSupabase(http, client, offlineBatch, readCount)) {
          for (size_t i = 0; i < readCount; i++) {
            appendToFlash(offlineBatch[i]);
          }
          vTaskDelay(pdMS_TO_TICKS(2000));
        }
      }
    }
  }
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);

  LittleFS.begin(true);

  txQueue = xQueueCreate(32, sizeof(GpsData));
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(true);
  esp_wifi_set_ps(WIFI_PS_MIN_MODEM);
  WiFi.onEvent(onWiFiEvent);
  WiFi.begin(wifiList[0].ssid, wifiList[0].password);

  configureGps();

  cachedBatteryCharge = readBatteryCharge();
  lastBatteryCheck = millis();

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
        float currentHdop = gps.hdop.isValid() ? gps.hdop.hdop() : 99.0f;
        if (currentHdop > HDOP_MAX_ACCURACY) {
          continue;
        }

        uint32_t now = millis();
        if (now - lastBatteryCheck >= BATTERY_CHECK_INTERVAL_MS) {
          cachedBatteryCharge = readBatteryCharge();
          lastBatteryCheck = now;
        }

        double curLat = gps.location.lat();
        double curLng = gps.location.lng();
        float curSpeed = gps.speed.kmph();

        double dist = TinyGPSPlus::distanceBetween(curLat, curLng, lastLoggedLat, lastLoggedLng);
        bool isMoving = (curSpeed > SPEED_THRESHOLD) || (dist > DISTANCE_THRESHOLD);
        uint32_t requiredInterval = isMoving ? MOVING_INTERVAL_MS : IDLE_INTERVAL_MS;

        if (now - lastUploadTime >= requiredInterval) {
          if (!isMoving && lastLoggedLat != 0.0 && dist < DISTANCE_THRESHOLD) {
            continue;
          }

          GpsData packet;
          packet.lat = curLat;
          packet.lng = curLng;
          packet.speed = curSpeed;
          packet.hdop = currentHdop;
          packet.altitude = gps.altitude.isValid() ? gps.altitude.meters() : 0.0f;
          packet.course = gps.course.isValid() ? gps.course.deg() : 0.0f;
          packet.sats = gps.satellites.isValid() ? gps.satellites.value() : 0;
          packet.charge = cachedBatteryCharge;
          packet.trackerId = TRACKER_ID;

          if (gps.date.isValid() && gps.time.isValid()) {
            snprintf(
              packet.timestamp,
              sizeof(packet.timestamp),
              "%04d-%02d-%02dT%02d:%02d:%02dZ",
              gps.date.year(),
              gps.date.month(),
              gps.date.day(),
              gps.time.hour(),
              gps.time.minute(),
              gps.time.second()
            );
          } else {
            snprintf(packet.timestamp, sizeof(packet.timestamp), "");
          }

          if (xQueueSend(txQueue, &packet, 0) == pdTRUE) {
            lastLoggedLat = curLat;
            lastLoggedLng = curLng;
            lastUploadTime = now;
          } else {
            appendToFlash(packet);
          }
        }
      }
    }
  }
}