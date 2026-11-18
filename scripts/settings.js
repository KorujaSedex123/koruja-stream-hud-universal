/**
 * World settings registration and stream-mode helpers for Koruja Stream HUD Universal.
 */

import {
  DEFAULT_POSITIONS,
  MODULE_ID,
  OVERLAY_MODES,
  THEMES,
  slugifyName
} from "./constants.js";
import { PRESET_IDS, SYSTEM_PRESETS } from "./system-adapter.js";

/**
 * Reads a module world setting safely.
 * @param {string} key
 * @returns {any}
 */
export function getSetting(key) {
  return game.settings.get(MODULE_ID, key);
}

/**
 * Writes a module world setting.
 * @param {string} key
 * @param {any} value
 * @returns {Promise<any>}
 */
export function setSetting(key, value) {
  return game.settings.set(MODULE_ID, key, value);
}

/**
 * Registers all module settings and the configuration menu.
 * @param {Function} configAppClass - ApplicationV2 class for StreamPartyConfigApp
 * @param {Function} [onChange] - Callback invoked when HUD-affecting settings change
 */
export function registerSettings(configAppClass, onChange = () => {}) {
  const triggerChange = () => onChange();

  if (configAppClass) {
    game.settings.registerMenu(MODULE_ID, "partyConfigMenu", {
      name: "KORUJA_HUD.Settings.ConfigMenuName",
      label: "KORUJA_HUD.Settings.ConfigMenuLabel",
      hint: "KORUJA_HUD.Settings.ConfigMenuHint",
      icon: "fas fa-tv",
      type: configAppClass,
      restricted: true
    });
  }

  const themeChoices = {
    fantasy: "KORUJA_HUD.Themes.fantasy",
    tactical: "KORUJA_HUD.Themes.tactical",
    minimal: "KORUJA_HUD.Themes.minimal"
  };

  const overlayChoices = {
    "builtin-tactical": "KORUJA_HUD.OverlayModes.builtinTactical",
    "builtin-roleplay": "KORUJA_HUD.OverlayModes.builtinRoleplay",
    "custom-image": "KORUJA_HUD.OverlayModes.customImage",
    none: "KORUJA_HUD.OverlayModes.none"
  };

  const presetChoices = {};
  for (const id of PRESET_IDS) {
    presetChoices[id] = `KORUJA_HUD.Presets.${id}`;
  }

  game.settings.register(MODULE_ID, "streamUser", {
    name: "KORUJA_HUD.Settings.StreamUserName",
    hint: "KORUJA_HUD.Settings.StreamUserHint",
    scope: "world",
    config: true,
    type: String,
    default: "Stream",
    onChange: triggerChange
  });

  game.settings.register(MODULE_ID, "hideFoundryUI", {
    name: "KORUJA_HUD.Settings.HideFoundryUI",
    hint: "KORUJA_HUD.Settings.HideFoundryUIHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: triggerChange
  });

  game.settings.register(MODULE_ID, "theme", {
    name: "KORUJA_HUD.Settings.ThemeName",
    hint: "KORUJA_HUD.Settings.ThemeHint",
    scope: "world",
    config: true,
    type: String,
    choices: themeChoices,
    default: "fantasy",
    onChange: triggerChange
  });

  game.settings.register(MODULE_ID, "overlayMode", {
    name: "KORUJA_HUD.Settings.OverlayModeName",
    hint: "KORUJA_HUD.Settings.OverlayModeHint",
    scope: "world",
    config: true,
    type: String,
    choices: overlayChoices,
    default: "builtin-tactical",
    onChange: triggerChange
  });

  game.settings.register(MODULE_ID, "customOverlayImg", {
    name: "KORUJA_HUD.Settings.CustomOverlayImgName",
    hint: "KORUJA_HUD.Settings.CustomOverlayImgHint",
    scope: "world",
    config: true,
    type: String,
    filePicker: "image",
    default: "",
    onChange: triggerChange
  });

  game.settings.register(MODULE_ID, "campaignTitle", {
    name: "KORUJA_HUD.Settings.CampaignTitleName",
    hint: "KORUJA_HUD.Settings.CampaignTitleHint",
    scope: "world",
    config: true,
    type: String,
    default: "",
    onChange: triggerChange
  });

  game.settings.register(MODULE_ID, "campaignSubtitle", {
    name: "KORUJA_HUD.Settings.CampaignSubtitleName",
    hint: "KORUJA_HUD.Settings.CampaignSubtitleHint",
    scope: "world",
    config: true,
    type: String,
    default: "",
    onChange: triggerChange
  });

  game.settings.register(MODULE_ID, "systemPreset", {
    name: "KORUJA_HUD.Settings.SystemPresetName",
    hint: "KORUJA_HUD.Settings.SystemPresetHint",
    scope: "world",
    config: true,
    type: String,
    choices: presetChoices,
    default: "auto",
    onChange: triggerChange
  });

  game.settings.register(MODULE_ID, "customMappingJson", {
    name: "KORUJA_HUD.Settings.CustomMappingJsonName",
    hint: "KORUJA_HUD.Settings.CustomMappingJsonHint",
    scope: "world",
    config: false,
    type: String,
    default: "",
    onChange: triggerChange
  });

  game.settings.register(MODULE_ID, "partyActorIds", {
    scope: "world",
    config: false,
    type: Array,
    default: [],
    onChange: triggerChange
  });

  game.settings.register(MODULE_ID, "playerSlotConfigs", {
    scope: "world",
    config: false,
    type: Object,
    default: {},
    onChange: triggerChange
  });

  game.settings.register(MODULE_ID, "vdoRoomName", {
    name: "KORUJA_HUD.Settings.VdoRoomName",
    hint: "KORUJA_HUD.Settings.VdoRoomHint",
    scope: "world",
    config: true,
    type: String,
    default: "koruja_stream",
    onChange: triggerChange
  });

  game.settings.register(MODULE_ID, "bossActorId", {
    scope: "world",
    config: false,
    type: String,
    default: "",
    onChange: triggerChange
  });

  const toggleSettings = [
    ["showPrimaryBar", "ShowPrimaryBar", true],
    ["showSecondaryBar", "ShowSecondaryBar", true],
    ["showTertiaryBar", "ShowTertiaryBar", true],
    ["showDefense", "ShowDefense", true],
    ["showConditions", "ShowConditions", true],
    ["showRolls", "ShowRolls", true],
    ["showChatFeed", "ShowChatFeed", true],
    ["showCombatBox", "ShowCombatBox", true],
    ["showMusicTracker", "ShowMusicTracker", true],
    ["showQuestBox", "ShowQuestBox", false],
    ["autoPanCombat", "AutoPanCombat", true],
    ["cinematicHandouts", "CinematicHandouts", true],
    ["autoLocationBanner", "AutoLocationBanner", true]
  ];

  for (const [key, i18nKey, defaultVal] of toggleSettings) {
    game.settings.register(MODULE_ID, key, {
      name: `KORUJA_HUD.Settings.${i18nKey}Name`,
      hint: `KORUJA_HUD.Settings.${i18nKey}Hint`,
      scope: "world",
      config: true,
      type: Boolean,
      default: defaultVal,
      onChange: triggerChange
    });
  }

  game.settings.register(MODULE_ID, "customQuestText", {
    name: "KORUJA_HUD.Settings.CustomQuestTextName",
    hint: "KORUJA_HUD.Settings.CustomQuestTextHint",
    scope: "world",
    config: true,
    type: String,
    default: "",
    onChange: triggerChange
  });

  game.settings.register(MODULE_ID, "autoCenterInterval", {
    name: "KORUJA_HUD.Settings.AutoCenterIntervalName",
    hint: "KORUJA_HUD.Settings.AutoCenterIntervalHint",
    scope: "world",
    config: true,
    type: Number,
    range: { min: 0, max: 300, step: 5 },
    default: 0,
    onChange: triggerChange
  });

  game.settings.register(MODULE_ID, "cardPositions", {
    scope: "world",
    config: false,
    type: Object,
    default: { ...DEFAULT_POSITIONS },
    onChange: triggerChange
  });
}

/**
 * Returns true if the current client is running in Stream/OBS mode.
 * @returns {boolean}
 */
export function isStreamMode() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("streamhud") === "1") return true;
  if (game.view === "stream") return true;

  let streamUsername = "stream";
  try {
    streamUsername = String(getSetting("streamUser") || "Stream").trim().toLowerCase();
  } catch {
    // Fallback if called before settings init
  }
  return String(game.user?.name || "").trim().toLowerCase() === streamUsername;
}

/**
 * Resolves the effective overlay mode, honoring ?mode= URL overrides.
 * @returns {string}
 */
export function getOverlayMode() {
  const urlMode = new URLSearchParams(window.location.search).get("mode")?.toLowerCase();
  if (urlMode === "rp" || urlMode === "roleplay") return "builtin-roleplay";
  if (urlMode === "map" || urlMode === "tactical") return "builtin-tactical";
  if (urlMode === "none") return "none";

  try {
    const configured = getSetting("overlayMode");
    if (OVERLAY_MODES.includes(configured)) return configured;
  } catch {
    // Fallback
  }
  return "builtin-tactical";
}

/**
 * Resolves the active visual theme, honoring ?theme= URL overrides.
 * @returns {string}
 */
export function getTheme() {
  const urlTheme = new URLSearchParams(window.location.search).get("theme")?.toLowerCase();
  if (urlTheme && THEMES.includes(urlTheme)) return urlTheme;

  try {
    const configured = getSetting("theme");
    if (THEMES.includes(configured)) return configured;
  } catch {
    // Fallback
  }
  return "fantasy";
}

/**
 * Builds VDO.Ninja push (player camera) and view (OBS/HUD iframe) URLs.
 * @param {string} room
 * @param {number|string|Actor} slotIndex - Slot index (0..5) or Actor object
 * @param {string} [actorName=""]
 * @returns {{ pushUrl: string, viewUrl: string }}
 */
export function buildVdoLinks(room, slotIndex, actorName = "") {
  const safeRoom = slugifyName(room || "koruja_stream", "koruja_stream");
  let streamId;
  let labelText;

  if (slotIndex && typeof slotIndex === "object") {
    const actor = slotIndex;
    const rawName = actor.name || actorName || "player";
    const idSuffix = actor.id ? `_${String(actor.id).slice(0, 5)}` : "";
    streamId = `${slugifyName(rawName, "player")}${idSuffix}`;
    labelText = rawName;
  } else {
    const num = Number(slotIndex);
    const displaySlot = Number.isFinite(num) ? num + 1 : String(slotIndex || 1);
    const base = actorName ? slugifyName(actorName, "player") : `slot_${displaySlot}`;
    streamId = `${base}_p${displaySlot}`;
    labelText = actorName || `Player ${displaySlot}`;
  }

  const label = encodeURIComponent(labelText);
  return {
    pushUrl: `https://vdo.ninja/?room=${safeRoom}&push=${streamId}&label=${label}&noaudio`,
    viewUrl: `https://vdo.ninja/?room=${safeRoom}&view=${streamId}&cleanoutput&transparent`
  };
}
