import argparse
import asyncio
import json
import sys
import time
from pathlib import Path

try:
    from bleak import BleakClient, BleakScanner
except Exception:
    try:
        from bleak.backends.winrt.client import BleakClientWinRT as BleakClient
        from bleak.backends.winrt.scanner import BleakScannerWinRT as BleakScanner
    except Exception:
        BleakClient = None
        BleakScanner = None


ROOT = Path(__file__).resolve().parents[1]
STATE_FILE = ROOT / "state" / "current_state.json"
DEVICE_PREFIX = "CodexBuddy-"
NUS_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
NUS_RX_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
NUS_TX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"


def normalize_state(raw):
    if not isinstance(raw, str):
        return "idle"
    state = raw.lower().strip()
    aliases = {
        "agent-turn-complete": "done",
        "turn_completed": "done",
        "turn_started": "running",
        "approval_requested": "waiting",
        "failed": "error",
        "focus": "research",
        "researching": "research",
    }
    state = aliases.get(state, state)
    if state in {
        "idle",
        "running",
        "waiting",
        "done",
        "error",
        "research",
        "break",
        "longbreak",
    }:
        return state
    return "idle"


def read_current_state():
    if not STATE_FILE.exists():
        return {
            "state": "idle",
            "msg": "Idle",
            "source": "codex-m5stack-buddy",
        }

    try:
        data = json.loads(STATE_FILE.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError):
        return {
            "state": "error",
            "msg": "State read error",
            "source": "codex-m5stack-buddy",
        }

    state = normalize_state(data.get("state") or data.get("status"))
    message = data.get("short_message") or data.get("message") or state
    return {
        "state": state,
        "msg": str(message)[:96],
        "source": "codex-m5stack-buddy",
        "ts": int(time.time()),
    }


async def find_device(name=None, timeout=8.0):
    print(f"Scanning for BLE buddy devices for {timeout:.0f}s...", flush=True)
    devices = await BleakScanner.discover(timeout=timeout, service_uuids=[NUS_SERVICE_UUID])
    for device in devices:
        device_name = device.name or ""
        if name and device_name == name:
            return device
        if not name and device_name.startswith(DEVICE_PREFIX):
            return device
    return None


async def run_bridge(name, interval, once):
    if BleakClient is None or BleakScanner is None:
        print("Missing dependency: bleak", file=sys.stderr, flush=True)
        print("Install it with: pip install bleak", file=sys.stderr, flush=True)
        return 2

    while True:
        device = await find_device(name=name)
        if device is None:
            print("No CodexBuddy BLE device found. Is the StickC firmware running?", flush=True)
            if once:
                return 1
            await asyncio.sleep(3)
            continue

        print(f"Connecting to {device.name} [{device.address}]...", flush=True)
        try:
            async with BleakClient(device) as client:
                print("Connected. Streaming state/current_state.json to StickC.", flush=True)

                def on_notify(_, data):
                    text = data.decode("utf-8", errors="replace").strip()
                    if text:
                        print(f"< {text}", flush=True)

                await client.start_notify(NUS_TX_UUID, on_notify)
                last_payload = None
                while client.is_connected:
                    payload = read_current_state()
                    encoded = (json.dumps(payload, separators=(",", ":")) + "\n").encode("utf-8")
                    if encoded != last_payload:
                        await client.write_gatt_char(NUS_RX_UUID, encoded, response=False)
                        print(f"> {encoded.decode('utf-8').strip()}", flush=True)
                        last_payload = encoded
                    if once:
                        await asyncio.sleep(0.5)
                        return 0
                    await asyncio.sleep(interval)
        except Exception as exc:
            print(f"BLE bridge disconnected: {exc}", flush=True)
            if once:
                return 1
            await asyncio.sleep(3)


def main():
    parser = argparse.ArgumentParser(description="Bridge Codex Buddy state to StickC over BLE NUS.")
    parser.add_argument("--name", help="BLE device name, defaults to CodexBuddy-*")
    parser.add_argument("--interval", type=float, default=1.0, help="Polling interval in seconds")
    parser.add_argument("--once", action="store_true", help="Send one state update and exit")
    args = parser.parse_args()

    raise SystemExit(asyncio.run(run_bridge(args.name, args.interval, args.once)))


if __name__ == "__main__":
    main()
