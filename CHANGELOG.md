# Changelog

All notable changes to **Koruja Stream HUD — Universal Stream Overlay** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-11-18

### Security & Hardening
- Gated `game.korujaStreamHud.showLocation` and `game.korujaStreamHud.triggerBanner` behind GM-only checks (`if (!game.user?.isGM) return;`).
- Replaced raw `innerHTML` interpolation in `renderActorDirectory` action buttons with safe DOM node construction (`document.createElement` + `document.createTextNode`).
- Hardened socket/chat/HTML rendering, URL validation, and custom mapping sanitization.

### CI/CD
- Eliminated GitHub Actions script injection in `.github/workflows/release.yml` by passing `TAG`, `CLEAN_VERSION`, `REPO`, and dispatch inputs through `env:` (`process.env.*`).
- Added `workflow_dispatch` (with optional `tag` input) alongside `push: tags: ['v*']`, with a `concurrency` group and `permissions: contents: write`.
- Added JS syntax validation (`node --input-type=module --check`) in CI alongside JSON manifest/localization validation before packaging `module.zip`.

## [1.0.0] - 2026-11-18

### Added
- **System-Agnostic Architecture**: Universal RPG system adapter with built-in presets for `dnd5e`, `pf2e`, `deltagreen`, `coc7`, `tormenta20`, `swade`, `generic` (heuristic auto-detection), and `custom` JSON dot-path mapping.
- **3 Visual Themes**: `fantasy` (ornate dark-gold), `tactical` (modern CRT/HUD), and `minimal` (clean frosted glass).
- **4 Broadcast Overlay Modes**: `builtin-tactical` (Map + HUD), `builtin-roleplay` (3×2 webcam/portrait grid), `custom-image` (1920×1080 custom frame), and `none` (transparent overlay).
- **Persistent Media Layer**: Per-player slot modes (`transparent`, `portrait`, `iframe`) with 1-click VDO.Ninja room and push/view link generation.
- **Live HUD Widgets**: Up to 6 draggable player cards on a 1920×1080 stage, Boss HP bar with delayed damage trail, Combat/Initiative tracker, Chat & Roll telemetry feed, Now Playing music ticker, Quest/Objective box, and Location/Epic banners.
- **Cross-Device Sync**: Real-time `game.socket` + `BroadcastChannel` synchronization for banners, handout spotlights, and HUD refreshes.
- **Configurator & Public API**: Tabbed configuration dialog (`StreamPartyConfigApp`) with live data-path tester and `game.modules.get("koruja-stream-hud-universal").api` for macros and external integrations.
- **Localization**: Full English (`en`) and Brazilian Portuguese (`pt-BR`) translations.
- **CI/CD**: GitHub Actions release workflow validating `module.json` and `lang/*.json` and packaging `module.zip` on `v*` tag pushes.
