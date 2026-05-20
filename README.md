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
      assets/
        yellow/
          pet/
            idle.png
            running.png
            waiting.png
            done.png
            error.png
            research.png
            break.png
            longbreak.png
            transparent/
          scene/
            .gitkeep
            bg_day.png
            bg_night.png
            house_idle.png
            house_work.png
            house_sleep.png
            transparent/
  web/
    index.html
    stickc.html
    stickc_portrait.html
    app.js
    styles.css
  state/
    .gitkeep
  logs/
    .gitkeep
  scripts/
    prepare_sprites.py
    remove_white_bg.py
    test_notify.ps1
    set_state.ps1
    set_pomodoro_state.ps1
    install_config_example.ps1
```

## Codex-Kitty Theme

Codex-Kitty is the default pet theme, not the project name. The three reference
images are the same character in different fur-color skins.

Skins:

- `yellow`: default skin, from `pets/codex_kitty/references/01_base_yellow.png`.
  It has per-state PNG assets in `pets/codex_kitty/assets/yellow/`.
- `black_white_tuxedo`: optional skin, from
  `pets/codex_kitty/references/02_black_white_tuxedo.png`. It currently uses
  its preview image as a fallback.
- `calico`: optional skin, from `pets/codex_kitty/references/03_calico.png`.
  It currently uses its preview image as a fallback.

The simulator uses per-state PNGs when the selected skin has `asset_dir`.
Otherwise it displays the selected skin's `preview_image`.

## Scene System

Codex-Kitty is now modeled as a small scene instead of one flattened image.
Each state can define optional scene fields:

```json
{
  "background": "bg_day.png",
  "ground": "ground_patch.png",
  "house": "house_idle.png",
  "prop": "prop_laptop.png",
  "overlay": "overlay_sparkles.png"
}
```

The web simulator renders these layers in order:

```text
background
ground
house
pet sprite
prop
overlay
UI
```

Current yellow pet sprites live in:

```text
pets/codex_kitty/assets/yellow/pet/
```

Scene art is expected under:

```text
pets/codex_kitty/assets/yellow/scene/
```

The scene image paths are already wired in `states.json`. If a scene PNG is not
present yet, the web simulator hides that layer and uses a lightweight fallback
background so development can continue before final art is available.

Pet and house art can be made scene-ready by removing edge-connected white
backgrounds:

```powershell
python .\scripts\remove_white_bg.py
```

The script reads:

```text
pets/codex_kitty/assets/yellow/pet/*.png
pets/codex_kitty/assets/yellow/scene/ground_patch.png
pets/codex_kitty/assets/yellow/scene/house_idle.png
pets/codex_kitty/assets/yellow/scene/house_sleep.png
```

and writes transparent PNGs to:

```text
pets/codex_kitty/assets/yellow/pet/transparent/
pets/codex_kitty/assets/yellow/scene/transparent/
```

The web simulator prefers transparent pet and house files, then falls back to
the original PNGs. Pillow is required:

```powershell
pip install pillow
```

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

There are three web views:

- Dashboard view: `http://localhost:8000/web/`
- StickC landscape preview: `http://localhost:8000/web/stickc.html`
- StickC portrait preview: `http://localhost:8000/web/stickc_portrait.html`

Both views load:

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

The dashboard keeps the larger development controls for skin and state preview.
The StickC previews are small-screen electronic-pet layouts intended to guide a
future M5StickC Plus port. They show only the pet name, current state short
message, tiny status badge, and compact one-line status.

Current animation is CSS-based procedural animation applied to the PNG sprite
image element. It does not redraw the cat in CSS. Future hardware and simulator
versions can upgrade these effects to multi-frame sprite animation.

## Agent And Pomodoro Modes

The simulator keeps Agent Mode and Pomodoro Mode as separate state sources.

Agent Mode comes from:

```text
state/current_state.json
```

Pomodoro Mode comes from:

```text
state/pomodoro_state.json
```

The UI fuses them with simple rules:

- Pomodoro `focus` nudges the pet toward `research`, unless Codex is currently
  `running`, `waiting`, or `error`.
- Pomodoro `break` displays the `break` scene.
- Pomodoro `longbreak` displays the `longbreak` scene.
- Agent Mode still provides Codex status such as `idle`, `running`, `waiting`,
  `done`, `error`, and `research`.

Dashboard view shows fuller Pomodoro information. StickC landscape shows compact
timer text. StickC portrait shows a single line such as `24:13 Focus`.

## Prepare Small-Screen Pet Sprites

The source yellow sprites can contain white margins that waste space on a small
screen. Generate scene-system pet sprites with trimmed white edges and safe
padding:

```powershell
python .\scripts\prepare_sprites.py
```

If Pillow is not installed:

```powershell
pip install pillow
```

The script reads:

```text
pets/codex_kitty/assets/yellow/*.png
```

and writes:

```text
pets/codex_kitty/assets/yellow/pet/*.png
```

The web simulator prefers `pet/*.png`, then falls back to the legacy
`processed/*.png`, then the original state PNG, then the skin preview image.

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

## Change Pomodoro State

Use `scripts/set_pomodoro_state.ps1` from the project root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set_pomodoro_state.ps1 reset
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set_pomodoro_state.ps1 set focus
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set_pomodoro_state.ps1 set break
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set_pomodoro_state.ps1 set longbreak
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set_pomodoro_state.ps1 start
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set_pomodoro_state.ps1 pause
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set_pomodoro_state.ps1 next
```

The Pomodoro state file contains:

```json
{
  "enabled": true,
  "mode": "focus",
  "duration_seconds": 1500,
  "remaining_seconds": 1500,
  "is_running": true,
  "cycle_index": 0,
  "focus_minutes": 25,
  "short_break_minutes": 5,
  "long_break_minutes": 15,
  "long_break_every": 4
}
```

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
