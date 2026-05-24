import argparse
import json
import time
from pathlib import Path

from codex_ble_bridge import read_current_state

try:
    import serial
except ImportError:
    serial = None


ROOT = Path(__file__).resolve().parents[1]


def run_bridge(port, baud, interval, once):
    if serial is None:
        raise SystemExit("Missing dependency: pyserial. Install it with: pip install pyserial")

    print(f"Opening {port} at {baud} baud...", flush=True)
    with serial.Serial(port, baud, timeout=0.1, write_timeout=1) as ser:
        print("Connected. Streaming state/current_state.json to StickC over USB serial.", flush=True)
        last_payload = None
        while True:
            payload = read_current_state()
            encoded = (json.dumps(payload, separators=(",", ":")) + "\n").encode("utf-8")
            if encoded != last_payload:
                ser.write(encoded)
                ser.flush()
                print(f"> {encoded.decode('utf-8').strip()}", flush=True)
                last_payload = encoded

            deadline = time.monotonic() + interval
            while time.monotonic() < deadline:
                line = ser.readline()
                if line:
                    print(f"< {line.decode('utf-8', errors='replace').strip()}", flush=True)
                if once:
                    return
                time.sleep(0.02)


def main():
    parser = argparse.ArgumentParser(description="Bridge Codex Buddy state to StickC over USB serial.")
    parser.add_argument("--port", default="COM3", help="Serial port")
    parser.add_argument("--baud", type=int, default=115200, help="Serial baud rate")
    parser.add_argument("--interval", type=float, default=1.0, help="Polling interval in seconds")
    parser.add_argument("--once", action="store_true", help="Send one state update and exit")
    args = parser.parse_args()

    run_bridge(args.port, args.baud, args.interval, args.once)


if __name__ == "__main__":
    main()
