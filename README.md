# codex-m5stack-buddy

`codex-m5stack-buddy` is a local Codex Buddy Bridge plus a small web simulator
for a future M5Stack companion device. The project name remains
`codex-m5stack-buddy`.

The default pet theme is **Codex-Kitty**: a pixel-art coding and vibe research
companion with cyan glowing eyes, a cyan `</>` forehead mark, and a cyan
lightning-like tail accent.

## Current Scope

Current version:

- Receives Codex `notify` JSON for `agent-turn-complete`.
- Appends raw events to `logs/events.jsonl`.
- Writes normalized state to `state/current_state.json`.
- Provides a terminal status panel.
- Provides a static web simulator using the Codex-Kitty theme.

Not implemented yet:

- M5Stack firmware.
- BLE, Serial, ESP-NOW, or Wi-Fi hardware transport.
- Voice.
- App server.
- Approve or deny workflows.

## Project Layout

```text
codex-m5stack-buddy/
  README.md
  codex_buddy_notify.py
  buddy_status.py
  pets/
    codex_kitty/
      design.md
      states.json
      references/
        01_base_yellow.png
        02_black_white_tuxedo.png
        03_calico.png
  web/
    index.html
    app.js
    styles.css
  state/
    .gitkeep
  logs/
    .gitkeep
  scripts/
    test_notify.ps1
    set_state.ps1
    install_config_example.ps1
```

## Codex-Kitty Theme

Codex-Kitty is the default pet theme, not the project name. The three reference
images are the same character in different fur-color skins.

Skins:

- `yellow`: default skin, from `pets/codex_kitty/references/01_base_yellow.png`.
- `black_white_tuxedo`: optional skin, from
  `pets/codex_kitty/references/02_black_white_tuxedo.png`.
- `calico`: optional skin, from `pets/codex_kitty/references/03_calico.png`.

The simulator does not cut those images into sprites yet. It displays the
selected skin's full reference sheet and uses text plus small status chips for
state feedback.

## Rename The Pet

Theme name and pet display name are separate in
`pets/codex_kitty/states.json`:

```json
{
  "theme_name": "Codex-Kitty",
  "default_pet_name": "Codex-Kitty",
  "user_pet_name": null
}
```

To name your personal kitty `Electra`, edit only `user_pet_name`:

```json
{
  "theme_name": "Codex-Kitty",
  "default_pet_name": "Codex-Kitty",
  "user_pet_name": "Electra"
}
```

The UI displays `user_pet_name` when it is set. Otherwise it displays
`default_pet_name`.

## Switch Skin

The default skin is controlled by `default_skin` in
`pets/codex_kitty/states.json`:

```json
"default_skin": "yellow"
```

Change it to an optional skin when desired:

```json
"default_skin": "black_white_tuxedo"
```

or:

```json
"default_skin": "calico"
```

The web simulator also includes a skin selector for quick preview.

## Web Simulator

Start a local static server from the project root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start_web.ps1
```

Then open:

```text
http://localhost:8000/web/
```

The simulator loads:

- `pets/codex_kitty/states.json`
- `state/current_state.json`

It supports these visible states:

```text
idle
running
waiting
done
error
research
break
longbreak
```

`research` replaces the older `focus` concept to emphasize vibe research.
Legacy `focus` is treated as deprecated and maps to `research`.

## Change Simulator State

Use `scripts/set_state.ps1` from the project root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set_state.ps1 idle
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set_state.ps1 running
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set_state.ps1 waiting
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set_state.ps1 done
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set_state.ps1 error
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set_state.ps1 research
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set_state.ps1 break
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set_state.ps1 longbreak
```

The web simulator polls `state/current_state.json`, so it updates shortly after
the state file changes.

## Local Notify Test

From the project root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\test_notify.ps1
```

The test sends a simulated Codex `agent-turn-complete` JSON payload to
`codex_buddy_notify.py`, then prints the terminal status panel.

Expected generated files:

```text
logs/events.jsonl
state/current_state.json
```

Display the latest state:

```powershell
python .\buddy_status.py
```

## Codex Notify Integration

Codex supports a top-level `notify` setting in `~/.codex/config.toml`. The
configured command is invoked after a supported event, and Codex appends one
JSON string argument. Current Codex docs describe `agent-turn-complete` as the
supported event for this external notify hook.

Print a Windows PowerShell-friendly config example:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install_config_example.ps1
```

It only prints an example. It does not edit your real `~/.codex/config.toml`.

The generated example looks like:

```toml
notify = ["python", "C:\\path\\to\\codex-m5stack-buddy\\codex_buddy_notify.py"]
```

After editing `~/.codex/config.toml`, restart Codex so it reloads the config.

## Future Hardware Bridge

Later versions can keep this notify bridge and simulator state model as the
producer, then add hardware transports:

- BLE: send line-delimited JSON state updates to M5Stack firmware.
- Serial: stream normalized JSON over USB serial for simple debugging.
- Wi-Fi: serve or push state updates over a local trusted network.

The current stage is intentionally limited to web simulator and state
configuration.
