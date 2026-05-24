#include <Arduino.h>
#include <BLE2902.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <SPI.h>
#include <Wire.h>

#include "codex_kitty_sprites.h"

namespace {
constexpr uint8_t TFT_SCLK = 13;
constexpr uint8_t TFT_MOSI = 15;
constexpr uint8_t TFT_CS = 5;
constexpr uint8_t TFT_DC = 23;
constexpr uint8_t TFT_RST = 18;
constexpr uint8_t TFT_BL = 27;
constexpr uint8_t BTN_A = 37;
constexpr uint8_t IMU_SDA = 21;
constexpr uint8_t IMU_SCL = 22;
constexpr uint8_t IMU_ADDR = 0x68;
constexpr char BLE_DEVICE_NAME[] = "CodexBuddy-5324";
constexpr char NUS_SERVICE_UUID[] = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
constexpr char NUS_RX_UUID[] = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
constexpr char NUS_TX_UUID[] = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

// Keep Codex-Kitty at the exported absolute pixel size across portrait and
// future landscape layouts. Only reposition UI around the sprite.
constexpr uint16_t PORTRAIT_W = 240;
constexpr uint16_t PORTRAIT_H = 320;
constexpr uint16_t LANDSCAPE_W = 320;
constexpr uint16_t LANDSCAPE_H = 240;

enum class Layout {
  Portrait,
  LandscapeLeft,
  LandscapeRight,
};

enum class BuddyState {
  Idle,
  Running,
  Waiting,
  Done,
  Error,
  Research,
  Break,
  LongBreak,
};

static_assert(static_cast<int>(BuddyState::Idle) == 0);

uint32_t lastFrameMs = 0;
uint32_t lastImuMs = 0;
uint32_t frame = 0;
bool lastButtonPressed = false;
bool imuReady = false;
bool bleClientConnected = false;
Layout currentLayout = Layout::Portrait;
Layout pendingLayout = Layout::Portrait;
uint8_t pendingLayoutCount = 0;
BuddyState buddyState = BuddyState::Idle;
BLECharacteristic* bleTx = nullptr;
char bleLine[512] = {};
uint16_t bleLineLen = 0;
char serialLine[512] = {};
uint16_t serialLineLen = 0;

uint16_t screenW() {
  return currentLayout == Layout::Portrait ? PORTRAIT_W : LANDSCAPE_W;
}

uint16_t screenH() {
  return currentLayout == Layout::Portrait ? PORTRAIT_H : LANDSCAPE_H;
}

void writeCommand(uint8_t command) {
  digitalWrite(TFT_DC, LOW);
  digitalWrite(TFT_CS, LOW);
  SPI.transfer(command);
  digitalWrite(TFT_CS, HIGH);
}

void writeData(uint8_t data) {
  digitalWrite(TFT_DC, HIGH);
  digitalWrite(TFT_CS, LOW);
  SPI.transfer(data);
  digitalWrite(TFT_CS, HIGH);
}

void writeData16(uint16_t data) {
  writeData(data >> 8);
  writeData(data & 0xff);
}

uint16_t rgb565(uint8_t r, uint8_t g, uint8_t b) {
  return ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3);
}

const char* buddyStateName(BuddyState state) {
  switch (state) {
    case BuddyState::Running:
      return "running";
    case BuddyState::Waiting:
      return "waiting";
    case BuddyState::Done:
      return "done";
    case BuddyState::Error:
      return "error";
    case BuddyState::Research:
      return "research";
    case BuddyState::Break:
      return "break";
    case BuddyState::LongBreak:
      return "longbreak";
    case BuddyState::Idle:
    default:
      return "idle";
  }
}

uint16_t buddyStateColor(BuddyState state) {
  switch (state) {
    case BuddyState::Running:
    case BuddyState::Research:
      return rgb565(0, 220, 255);
    case BuddyState::Waiting:
    case BuddyState::Break:
      return rgb565(255, 128, 216);
    case BuddyState::Done:
      return rgb565(255, 200, 106);
    case BuddyState::Error:
      return rgb565(255, 92, 122);
    case BuddyState::LongBreak:
      return rgb565(154, 160, 166);
    case BuddyState::Idle:
    default:
      return rgb565(110, 118, 134);
  }
}

BuddyState parseBuddyState(const char* line) {
  if (strstr(line, "\"state\":\"running\"")) {
    return BuddyState::Running;
  }
  if (strstr(line, "\"state\":\"waiting\"")) {
    return BuddyState::Waiting;
  }
  if (strstr(line, "\"state\":\"done\"")) {
    return BuddyState::Done;
  }
  if (strstr(line, "\"state\":\"error\"")) {
    return BuddyState::Error;
  }
  if (strstr(line, "\"state\":\"research\"")) {
    return BuddyState::Research;
  }
  if (strstr(line, "\"state\":\"break\"")) {
    return BuddyState::Break;
  }
  if (strstr(line, "\"state\":\"longbreak\"")) {
    return BuddyState::LongBreak;
  }
  return BuddyState::Idle;
}

CodexKittySpriteId spriteIdForState(BuddyState state) {
  switch (state) {
    case BuddyState::Running:
      return CodexKittySpriteId::Running;
    case BuddyState::Waiting:
      return CodexKittySpriteId::Waiting;
    case BuddyState::Done:
      return CodexKittySpriteId::Done;
    case BuddyState::Error:
      return CodexKittySpriteId::Error;
    case BuddyState::Research:
      return CodexKittySpriteId::Research;
    case BuddyState::Break:
      return CodexKittySpriteId::Break;
    case BuddyState::LongBreak:
      return CodexKittySpriteId::Longbreak;
    case BuddyState::Idle:
    default:
      return CodexKittySpriteId::Idle;
  }
}

void setAddressWindow(uint16_t x0, uint16_t y0, uint16_t x1, uint16_t y1) {
  writeCommand(0x2a);
  writeData16(x0);
  writeData16(x1);
  writeCommand(0x2b);
  writeData16(y0);
  writeData16(y1);
  writeCommand(0x2c);
}

void fillRect(uint16_t x, uint16_t y, uint16_t w, uint16_t h, uint16_t color) {
  const uint16_t width = screenW();
  const uint16_t height = screenH();
  if (x >= width || y >= height) {
    return;
  }
  if (x + w > width) {
    w = width - x;
  }
  if (y + h > height) {
    h = height - y;
  }

  setAddressWindow(x, y, x + w - 1, y + h - 1);
  digitalWrite(TFT_DC, HIGH);
  digitalWrite(TFT_CS, LOW);
  for (uint32_t i = 0; i < static_cast<uint32_t>(w) * h; ++i) {
    SPI.transfer16(color);
  }
  digitalWrite(TFT_CS, HIGH);
}

void fillScreen(uint16_t color) {
  fillRect(0, 0, screenW(), screenH(), color);
}

void drawBitmapTransparent(int16_t x, int16_t y, const uint16_t* bitmap,
                           uint16_t width, uint16_t height) {
  for (uint16_t row = 0; row < height; ++row) {
    uint16_t col = 0;
    while (col < width) {
      while (col < width &&
             pgm_read_word(&bitmap[row * width + col]) == CODEX_KITTY_TRANSPARENT) {
        ++col;
      }

      const uint16_t start = col;
      while (col < width &&
             pgm_read_word(&bitmap[row * width + col]) != CODEX_KITTY_TRANSPARENT) {
        ++col;
      }

      if (start == col) {
        continue;
      }

      const int16_t screenY = y + row;
      const int16_t screenX = x + start;
      const uint16_t runWidth = col - start;
      if (screenY < 0 || screenY >= screenH() || screenX >= screenW() ||
          screenX + runWidth <= 0) {
        continue;
      }

      const uint16_t visibleStart = screenX < 0 ? -screenX : 0;
      const uint16_t visibleWidth =
          min<uint16_t>(runWidth - visibleStart, screenW() - max<int16_t>(screenX, 0));
      setAddressWindow(max<int16_t>(screenX, 0), screenY,
                       max<int16_t>(screenX, 0) + visibleWidth - 1, screenY);
      digitalWrite(TFT_DC, HIGH);
      digitalWrite(TFT_CS, LOW);
      for (uint16_t i = 0; i < visibleWidth; ++i) {
        SPI.transfer16(pgm_read_word(&bitmap[row * width + start + visibleStart + i]));
      }
      digitalWrite(TFT_CS, HIGH);
    }
  }
}

void initDisplay() {
  pinMode(TFT_CS, OUTPUT);
  pinMode(TFT_DC, OUTPUT);
  pinMode(TFT_RST, OUTPUT);
  pinMode(TFT_BL, OUTPUT);
  digitalWrite(TFT_CS, HIGH);
  digitalWrite(TFT_BL, HIGH);

  SPI.begin(TFT_SCLK, -1, TFT_MOSI, TFT_CS);
  SPI.setFrequency(40000000);

  digitalWrite(TFT_RST, LOW);
  delay(50);
  digitalWrite(TFT_RST, HIGH);
  delay(120);

  writeCommand(0x01);
  delay(150);
  writeCommand(0x11);
  delay(150);
  writeCommand(0x3a);
  writeData(0x55);
  writeCommand(0x36);
  writeData(0x00);
  writeCommand(0x21);
  writeCommand(0x13);
  writeCommand(0x29);
  delay(20);
}

void setDisplayLayout(Layout layout) {
  currentLayout = layout;
  writeCommand(0x36);
  if (layout == Layout::LandscapeLeft) {
    writeData(0xa0);
  } else if (layout == Layout::LandscapeRight) {
    writeData(0x60);
  } else {
    writeData(0x00);
  }
}

void drawSmokeFrame();
void sendBleLine(const char* line);
void handleBridgeLine(const char* line);
void handleBridgeInput(char c, char* buffer, uint16_t& length) {
  if (c == '\n' || c == '\r') {
    if (length > 0) {
      buffer[length] = '\0';
      handleBridgeLine(buffer);
      length = 0;
    }
  } else if (length < 511) {
    buffer[length++] = c;
  }
}

void handleBridgeLine(const char* line) {
  if (strstr(line, "\"state\"")) {
    const BuddyState next = parseBuddyState(line);
    if (next != buddyState) {
      buddyState = next;
      drawSmokeFrame();
    }
    char ack[96];
    snprintf(ack, sizeof(ack), "{\"ack\":\"state\",\"ok\":true,\"state\":\"%s\"}\n",
             buddyStateName(buddyState));
    sendBleLine(ack);
  }
}

bool writeImuRegister(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(IMU_ADDR);
  Wire.write(reg);
  Wire.write(value);
  return Wire.endTransmission() == 0;
}

bool readImuAccel(int16_t& ax, int16_t& ay, int16_t& az) {
  Wire.beginTransmission(IMU_ADDR);
  Wire.write(0x3b);
  if (Wire.endTransmission(false) != 0) {
    return false;
  }
  if (Wire.requestFrom(IMU_ADDR, static_cast<uint8_t>(6)) != 6) {
    return false;
  }

  ax = static_cast<int16_t>((Wire.read() << 8) | Wire.read());
  ay = static_cast<int16_t>((Wire.read() << 8) | Wire.read());
  az = static_cast<int16_t>((Wire.read() << 8) | Wire.read());
  return true;
}

bool initImu() {
  Wire.begin(IMU_SDA, IMU_SCL);
  Wire.setClock(400000);

  Wire.beginTransmission(IMU_ADDR);
  if (Wire.endTransmission() != 0) {
    return false;
  }

  writeImuRegister(0x6b, 0x00);
  delay(20);
  writeImuRegister(0x1c, 0x00);
  return true;
}

Layout layoutFromAccel(int16_t ax, int16_t ay, int16_t az) {
  const int16_t absX = abs(ax);
  const int16_t absY = abs(ay);
  const int16_t absZ = abs(az);

  if (absZ > absX + 2500 && absZ > absY + 2500) {
    return currentLayout;
  }
  if (absX > 8000 && absX > absY + 3500) {
    return ax > 0 ? Layout::LandscapeRight : Layout::LandscapeLeft;
  }
  if (absY > 8000 && absY > absX + 3500) {
    return Layout::Portrait;
  }
  return currentLayout;
}

void updateLayoutCandidate(Layout newLayout) {
  if (newLayout == currentLayout) {
    pendingLayout = newLayout;
    pendingLayoutCount = 0;
    return;
  }

  if (newLayout != pendingLayout) {
    pendingLayout = newLayout;
    pendingLayoutCount = 1;
    return;
  }

  ++pendingLayoutCount;
  if (pendingLayoutCount >= 4) {
    setDisplayLayout(newLayout);
    pendingLayoutCount = 0;
    drawSmokeFrame();
  }
}

void drawStatusBars(bool buttonPressed) {
  const uint16_t accent = buttonPressed ? rgb565(255, 65, 70) : buddyStateColor(buddyState);
  const uint16_t red = rgb565(255, 65, 70);
  const uint16_t panel = rgb565(17, 24, 39);

  const uint16_t width = screenW();
  const uint16_t height = screenH();
  fillRect(0, 0, width, 18, panel);
  fillRect(0, 18, width, 3, bleClientConnected ? accent : rgb565(82, 92, 110));
  fillRect(0, height - 48, width, 48, panel);
  fillRect(0, height - 51, width, 3, accent);
  fillRect(18, height - 41, width - 36, 8, buttonPressed ? red : accent);
}

void drawSmokeFrame() {
  const uint16_t bg = rgb565(8, 11, 18);
  const uint16_t shadow = rgb565(25, 34, 47);

  fillScreen(bg);
  drawStatusBars(digitalRead(BTN_A) == LOW);
  const CodexKittySprite& sprite =
      CODEX_KITTY_SPRITES[static_cast<int>(spriteIdForState(buddyState))];
  const int16_t spriteX = (screenW() - sprite.width) / 2;
  const int16_t spriteY = currentLayout == Layout::Portrait ? 112 : 78;
  fillRect((screenW() - 78) / 2, spriteY + sprite.height + 8, 78, 5, shadow);
  drawBitmapTransparent(spriteX, spriteY, sprite.pixels, sprite.width, sprite.height);
}

class BleServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer*) override {
    bleClientConnected = true;
    Serial.println("[ble] connected");
    drawSmokeFrame();
  }

  void onDisconnect(BLEServer*) override {
    bleClientConnected = false;
    Serial.println("[ble] disconnected");
    BLEDevice::startAdvertising();
    drawSmokeFrame();
  }
};

class BleRxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* characteristic) override {
    const std::string value = characteristic->getValue();
    for (char c : value) {
      handleBridgeInput(c, bleLine, bleLineLen);
    }
  }
};

void sendBleLine(const char* line) {
  if (!bleClientConnected || bleTx == nullptr) {
    return;
  }
  bleTx->setValue(std::string(line));
  bleTx->notify();
}

void initBle() {
  BLEDevice::init(BLE_DEVICE_NAME);
  BLEDevice::setMTU(185);

  BLEServer* server = BLEDevice::createServer();
  server->setCallbacks(new BleServerCallbacks());
  BLEService* service = server->createService(NUS_SERVICE_UUID);

  bleTx = service->createCharacteristic(NUS_TX_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  bleTx->addDescriptor(new BLE2902());

  BLECharacteristic* rx = service->createCharacteristic(
      NUS_RX_UUID, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  rx->setCallbacks(new BleRxCallbacks());

  service->start();
  BLEAdvertising* advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(NUS_SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->setMinPreferred(0x06);
  advertising->setMaxPreferred(0x12);
  BLEDevice::startAdvertising();
  Serial.printf("[ble] advertising as %s\n", BLE_DEVICE_NAME);
}
}  // namespace

void setup() {
  Serial.begin(115200);
  delay(200);
  pinMode(BTN_A, INPUT_PULLUP);

  Serial.println();
  Serial.println("codex-m5stack-buddy Codex-Kitty smoke test");
  Serial.println("target: M5StickC Plus on COM3");
  Serial.println("button A changes the status bar color");

  initDisplay();
  imuReady = initImu();
  Serial.printf("imu=%s\n", imuReady ? "ready" : "not-found");
  initBle();
  lastButtonPressed = digitalRead(BTN_A) == LOW;
  drawSmokeFrame();
}

void loop() {
  const uint32_t now = millis();
  while (Serial.available() > 0) {
    handleBridgeInput(static_cast<char>(Serial.read()), serialLine, serialLineLen);
  }

  const bool buttonPressed = digitalRead(BTN_A) == LOW;
  if (buttonPressed != lastButtonPressed) {
    lastButtonPressed = buttonPressed;
    drawStatusBars(buttonPressed);
    if (buttonPressed) {
      sendBleLine("{\"evt\":\"button\",\"button\":\"A\",\"pressed\":true}\n");
    }
  }

  if (imuReady && now - lastImuMs >= 250) {
    lastImuMs = now;
    int16_t ax = 0;
    int16_t ay = 0;
    int16_t az = 0;
    if (readImuAccel(ax, ay, az)) {
      updateLayoutCandidate(layoutFromAccel(ax, ay, az));
    }
  }

  if (now - lastFrameMs >= 1000) {
    lastFrameMs = now;
    ++frame;
    Serial.printf("buddy-smoke frame=%lu state=%s ble=%s buttonA=%s layout=%u uptime_ms=%lu\n",
                  static_cast<unsigned long>(frame),
                  buddyStateName(buddyState),
                  bleClientConnected ? "connected" : "advertising",
                  buttonPressed ? "pressed" : "released",
                  static_cast<unsigned>(currentLayout),
                  static_cast<unsigned long>(now));
  }
}
