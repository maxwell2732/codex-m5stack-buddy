# Project Notes For Agents

This repo is `codex-m5stack-buddy`, a local Codex status bridge, web simulator,
and M5StickC Plus hardware companion for the Codex-Kitty pet.

## Current Hardware State

- Target hardware: M5StickC Plus on USB serial `COM3`.
- PlatformIO environment lives in `firmware/`.
- Board profile: `m5stick-c`, framework `arduino`.
- Current firmware has been built and flashed successfully to the StickC Plus.
- The firmware drives the LCD directly over SPI and reads the internal IMU over
  I2C address `0x68`.
- The device auto-switches portrait/landscape based on IMU readings. The
  Codex-Kitty sprite size must remain an absolute `78x78` max export size in
  both orientations; only position and surrounding UI should change.
- Landscape rotation was corrected by swapping the LCD MADCTL values for left
  and right landscape.

## Firmware Features

- Uses generated RGB565 sprite data in
  `firmware/src/codex_kitty_sprites.h`.
- Sprite source files are:
  `pets/codex_kitty/assets/yellow/pet/transparent/*.png`.
- Generate the firmware sprite header with:

```powershell
C:\ProgramData\Miniconda3\python.exe .\scripts\export_firmware_sprite.py
```

- Uses the eight visible states: `idle`, `running`, `waiting`, `done`, `error`,
  `research`, `break`, and `longbreak`.
- The displayed sprite changes with the state. Do not regress to a single idle
  sprite for all states.
- The firmware accepts newline-delimited JSON over both BLE and USB serial.
- Pressing A sends a button event over BLE when connected.

## BLE And Serial Bridge

- BLE device name: `CodexBuddy-5324`.
- BLE protocol: Nordic UART Service.
- UUIDs:
  - service: `6e400001-b5a3-f393-e0a9-e50e24dcca9e`
  - RX: `6e400002-b5a3-f393-e0a9-e50e24dcca9e`
  - TX: `6e400003-b5a3-f393-e0a9-e50e24dcca9e`
- Computer bridge:
  `scripts/codex_ble_bridge.py`
- USB fallback bridge:
  `scripts/codex_serial_bridge.py`
- Both bridge scripts read `state/current_state.json`, normalize state aliases,
  and send compact newline-delimited JSON to the device.
- `state/current_state.json` may be written with a UTF-8 BOM by PowerShell; the
  bridge intentionally reads it with `utf-8-sig`.

## Python Environments

- Use this Python for BLE bridge work:

```powershell
C:\Users\zhuch\.conda\envs\pio\python.exe
```

- That environment is Python 3.11 and has `bleak 3.0.2` installed.
- Do not use `C:\ProgramData\Miniconda3\python.exe` for BLE bridge work. It is
  Python 3.9.1, and the installed `bleak 1.1.1` import path is broken in that
  environment.
- `C:\ProgramData\Miniconda3\python.exe` currently has Pillow and is used for
  sprite generation.

## Useful Commands

Build firmware:

```powershell
pio run -d .\firmware
```

Upload firmware:

```powershell
pio run -d .\firmware -t upload --upload-port COM3
```

Run BLE bridge:

```powershell
C:\Users\zhuch\.conda\envs\pio\python.exe .\scripts\codex_ble_bridge.py
```

One-shot BLE test:

```powershell
C:\Users\zhuch\.conda\envs\pio\python.exe .\scripts\codex_ble_bridge.py --once
```

USB serial fallback:

```powershell
C:\Users\zhuch\.conda\envs\pio\python.exe .\scripts\codex_serial_bridge.py --port COM3
```

Change local state:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set_state.ps1 running
```

## Verified Behavior

- USB serial smoke test works on `COM3`.
- BLE bridge has connected to `CodexBuddy-5324`.
- BLE ACK was observed:

```text
{"ack":"state","ok":true,"state":"running"}
```

- USB serial bridge has also been verified.
- Current limitation: the bridge must be kept running in a terminal. It is not
  yet installed as a Windows startup task or service.
