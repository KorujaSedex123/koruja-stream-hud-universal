# Koruja Stream HUD — Universal Stream Overlay

A lightweight, system-agnostic, 100% native **Foundry VTT** (v12–v14) stream overlay built for **OBS Studio**, **VDO.Ninja**, and live RPG broadcasts—with zero external servers required.

---

## Key Features

- **System-Agnostic RPG Adapter**: Works out of the box with **any** Foundry VTT game system. Includes built-in presets for:
  - **Auto-Detect** (matches `game.system.id` or falls back to `generic` heuristics)
  - **D&D 5e** (`dnd5e`)
  - **Pathfinder 2e** (`pf2e`)
  - **Delta Green** (`deltagreen`)
  - **Call of Cthulhu 7e** (`coc7`)
  - **Tormenta20** (`tormenta20`)
  - **Savage Worlds** (`swade`)
  - **Generic** (heuristic dot-path detection for any other system)
  - **Custom** (full JSON dot-path mapping with a live *"Test on Selected Actor"* preview)
- **3 Visual Themes**:
  - **Fantasy** — Warm gold and crimson ornate styling
  - **Tactical** — Dark cyber/investigative HUD with optional tactical telemetry
  - **Minimal** — Clean modern frosted glass
- **4 Broadcast Overlay Modes**:
  - **Tactical (`builtin-tactical`)** — Map viewport cutout + top bar + up to 6 player cutouts + GM cutout
  - **Roleplay (`builtin-roleplay`)** — 3×2 16:9 camera/portrait grid + GM cam + footer
  - **Custom Image (`custom-image`)** — Your own 1920×1080 PNG/WebP frame
  - **Transparent Only (`none`)** — Floating HUD cards over a transparent canvas
- **Persistent VDO.Ninja Media Layer**: Per-player slot modes (`transparent`, `portrait`, `iframe`) keyed by signature so webcam iframes never reload when HP, conditions, or combat turns update. Includes a 1-click VDO.Ninja room & Push/View link generator.
- **Live Broadcast Widgets**:
  - Up to 6 draggable Player Cards on a 1920×1080 stage (1–3 resource bars, defense & level pills, active effects, bloodied state, turn badge, roll toasts)
  - Boss / Priority Threat HP bar with delayed damage trail (toggleable via Token HUD Crown button)
  - Combat & Initiative tracker with active and next combatant
  - Public Chat & Roll telemetry feed (last 5 public rolls/messages)
  - Now Playing music tracker & Quest/Objective box
  - Epic Crit/Fumble banners, Scene Location lower-thirds, Cinematic Handout spotlights, and Pause overlay
- **Cross-Device Sync**: Real-time `game.socket` + `BroadcastChannel` synchronization between the GM client and the OBS Browser Source.

---

## Installation

1. In Foundry VTT, go to **Add-on Modules** → **Install Module**.
2. Paste the Manifest URL:
   ```
   https://github.com/KorujaSedex123/koruja-stream-hud-universal/releases/latest/download/module.json
   ```
3. Enable **Koruja Stream HUD — Universal Stream Overlay** in your world's **Manage Modules** settings.

---

## OBS Studio Browser Source Setup

1. Create a dedicated Foundry user for your stream (default name: `Stream`, configurable in **Module Settings**).
2. In OBS Studio, add a **Browser** source with resolution **1920 × 1080**.
3. Point the URL to your Foundry VTT server with `?streamhud=1`:
   - **Default / Auto**: `http://YOUR-FOUNDRY-URL/game?streamhud=1`
   - **Force Tactical (Map) Mode**: `http://YOUR-FOUNDRY-URL/game?streamhud=1&mode=map`
   - **Force Roleplay (Cam Grid) Mode**: `http://YOUR-FOUNDRY-URL/game?streamhud=1&mode=rp`
4. Log in as the `Stream` user inside the OBS Browser Source (using OBS **Interact**). When logged in as that user—or whenever `?streamhud=1` is present in the URL—Foundry's native UI is hidden and the 1920×1080 Stream HUD activates automatically.

> **Tip:** You can also copy ready-to-use OBS URLs directly from the **Live Controls** tab inside the Stream HUD Configurator.

---

## VDO.Ninja Integration

1. Open **Stream HUD Config** (from the **Actors** sidebar button or **Module Settings**).
2. In the **Party & VDO.Ninja** tab, enter a **VDO.Ninja Room** name.
3. Select up to 6 party actors and set each player's slot mode to **Webcam / Iframe (VDO.Ninja)**.
4. Click the **VDO** button next to a player slot to automatically generate the embed View URL for OBS and copy the private **Push URL** to your clipboard to send to that player.

---

## Presets & Custom Data-Path Mapping

If your RPG system is not one of the built-in presets (or if you use custom homebrew attributes), select **Custom** in the **System & Mapping** tab and provide dot-paths relative to the Foundry `Actor` document (e.g., `system.attributes.hp.value`).

Example custom mapping JSON:

```json
{
  "partyActorTypes": ["character", "pc"],
  "bossActorTypes": ["npc", "monster"],
  "primaryBar": {
    "valuePath": "system.attributes.hp.value",
    "maxPath": "system.attributes.hp.max",
    "tempPath": "system.attributes.hp.temp",
    "label": "HP"
  },
  "secondaryBar": {
    "valuePath": "system.resources.mana.value",
    "maxPath": "system.resources.mana.max",
    "label": "MP"
  },
  "tertiaryBar": null,
  "defense": {
    "path": "system.attributes.ac.value",
    "label": "AC"
  },
  "level": {
    "path": "system.details.level.value",
    "label": "LVL"
  },
  "rollMode": "d20"
}
```

Use the **Test on Selected Actor** button in the Configurator to verify extracted values in real time before saving.

---

## Public API

The module exposes a public API at `game.korujaStreamHud` for macros, Stream Deck integrations, and companion modules:

| Method | Description |
| :--- | :--- |
| `game.korujaStreamHud.openConfig()` | Opens the Stream HUD Configurator window. |
| `game.korujaStreamHud.refresh()` | Forces an immediate re-render of the HUD across all connected clients. |
| `game.korujaStreamHud.recenter()` | Re-centers the stream camera on the active combatant or party tokens. |
| `game.korujaStreamHud.setBoss(actorOrTokenUuid)` | Pins an Actor ID or Token UUID as the Boss/Threat bar (pass `null` to clear). |
| `game.korujaStreamHud.setMode(mode)` | Switches overlay mode (`"builtin-tactical"`, `"builtin-roleplay"`, `"custom-image"`, `"none"`). |
| `game.korujaStreamHud.setTheme(theme)` | Switches visual theme (`"fantasy"`, `"tactical"`, `"minimal"`). |
| `game.korujaStreamHud.showLocation(title, subtitle)` | Broadcasts a Scene/Location lower-third banner. |
| `game.korujaStreamHud.triggerBanner(type, payload)` | Broadcasts an epic banner (e.g. `"crit"`, `"fumble"`, or custom payload). |

---

## License

Licensed under the [MIT License](LICENSE).
