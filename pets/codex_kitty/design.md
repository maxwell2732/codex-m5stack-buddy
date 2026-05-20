# Codex-Kitty Design

Codex-Kitty is the default pet theme for `codex-m5stack-buddy`. The main
project remains `codex-m5stack-buddy`; Codex-Kitty is the default companion
character, pet skin, and visual language used by the current simulator.

## Character Identity

Codex-Kitty is a tiny coding and vibe research companion. The character should
feel like a small desk-side assistant for Codex agent activity: cute, readable
on M5Stack-class screens, and clearly connected to coding.

The three reference images are the same character in different fur-color skins,
not three separate characters.

Shared visual traits:

- Pixel-art style with clean, high-contrast outlines.
- Cyan glowing eyes.
- Cyan `</>` mark on the forehead.
- Cyan lightning-like tail accent.
- Cute chibi body proportions: large head, compact body, short paws.
- Small-screen readability for M5Stack Cardputer, Core, and StickC displays.
- Coding plus vibe research identity: laptops, notes, charts, magnifier, and
  terminal/code marks are appropriate props.

## Skins

The theme supports three skins:

- `yellow`: default skin. Based on `references/01_base_yellow.png`; warm cream
  and yellow fur with cyan coding accents.
- `black_white_tuxedo`: optional skin. Based on
  `references/02_black_white_tuxedo.png`; black-and-white tuxedo fur with cyan
  coding accents.
- `calico`: optional skin. Based on `references/03_calico.png`; white, orange,
  and black calico patches with cyan coding accents.

Do not slice these reference images into sprites yet. For now, the web
simulator displays the selected skin's full reference sheet and uses text plus
small status chips for state feedback.

## Naming

The theme name and pet display name are separate:

- `theme_name`: `Codex-Kitty`
- `default_pet_name`: `Codex-Kitty`
- `user_pet_name`: optional, defaults to `null`

UI should display `user_pet_name` when it is set to a non-empty string. When it
is `null` or empty, UI should display `default_pet_name`.

Example: the theme remains `Codex-Kitty`, but a user can name their individual
pet `Electra`.

## States

Codex-Kitty supports these primary states:

- `idle`: resting, low-priority, no action needed.
- `running`: Codex is working; kitty is typing or compiling.
- `waiting`: Codex needs user input; kitty raises a paw and requires action.
- `done`: Codex completed a turn; kitty celebrates.
- `error`: something failed; kitty looks dizzy and requires attention.
- `research`: vibe research mode; kitty explores notes, questions, and ideas.
- `break`: short break; kitty stretches.
- `longbreak`: longer rest; kitty naps.

`research` replaces the earlier `focus` concept because the project is centered
on vibe research rather than a generic focus timer. If `focus` appears in older
state files, it should be treated as deprecated and mapped to `research`.
