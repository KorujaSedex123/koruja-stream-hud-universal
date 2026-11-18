/**
 * Entry point, Foundry VTT hooks, camera automation, and public API
 * for Koruja Stream HUD Universal.
 */

import {
  MODULE_ID,
  I18N_PREFIX,
  THEMES,
  OVERLAY_MODES
} from "./constants.js";
import { analyzeChatRoll } from "./system-adapter.js";
import {
  registerSettings,
  getSetting,
  setSetting,
  isStreamMode,
  getOverlayMode,
  getTheme
} from "./settings.js";
import { initSocketBridge, emitHudEvent } from "./socket.js";
import { KorujaStreamHUD } from "./hud-renderer.js";
import { StreamPartyConfigApp } from "./config-app.js";

/**
 * Localize an i18n key under KORUJA_HUD.
 * @param {string} key
 * @param {Record<string, unknown>} [data]
 * @returns {string}
 */
function t(key, data) {
  const fullKey = `${I18N_PREFIX}.${key}`;
  if (data && typeof game?.i18n?.format === "function") {
    return game.i18n.format(fullKey, data);
  }
  return game?.i18n?.localize?.(fullKey) ?? key;
}

/**
 * Map overlay mode IDs to their i18n key suffix under KORUJA_HUD.OverlayModes.
 */
const OVERLAY_MODE_I18N = {
  "builtin-tactical": "OverlayModes.builtinTactical",
  "builtin-roleplay": "OverlayModes.builtinRoleplay",
  "custom-image": "OverlayModes.customImage",
  none: "OverlayModes.none"
};

/**
 * Normalize shorthand mode names for the public API.
 * @param {string} mode
 * @returns {string|null}
 */
function normalizeOverlayMode(mode) {
  const raw = String(mode || "").trim().toLowerCase();
  if (raw === "map" || raw === "tactical") return "builtin-tactical";
  if (raw === "rp" || raw === "roleplay") return "builtin-roleplay";
  if (OVERLAY_MODES.includes(raw)) return raw;
  return null;
}

/**
 * Open the Stream HUD configurator cleanly across Foundry V12-V14.
 */
function openConfigApp() {
  const app = new StreamPartyConfigApp();
  app.render({ force: true });
  return app;
}

/**
 * Pan the stream camera to the active combatant token when enabled.
 * @param {Combat} combat
 */
function panToActiveCombatant(combat) {
  if (!KorujaStreamHUD.shouldRender() || !canvas?.ready) return;
  if (!getSetting("autoPanCombat")) return;
  if (getOverlayMode() === "builtin-roleplay") return;
  if (!combat?.started || !combat.combatant) return;

  const combatant = combat.combatant;
  const token = combatant.token?.object;
  if (!token || combatant.hidden || token.document?.hidden) return;

  canvas.animatePan({
    x: token.center.x,
    y: token.center.y,
    duration: 800
  });
}

/**
 * Handle world setting changes across clients.
 */
function handleSettingsChange() {
  if (KorujaStreamHUD.shouldRender()) {
    KorujaStreamHUD.init();
  } else {
    KorujaStreamHUD.destroy();
  }
}

/**
 * Build and expose the public API at game.korujaStreamHud.
 */
function registerPublicApi() {
  game.korujaStreamHud = {
    openConfig: () => openConfigApp(),

    refresh: () => {
      if (KorujaStreamHUD.shouldRender()) {
        KorujaStreamHUD.render();
      }
      if (game.user?.isGM) {
        emitHudEvent("refresh", {}, { local: false });
      }
    },

    recenter: () => {
      KorujaStreamHUD.recenterCamera();
    },

    setBoss: async (actorOrUuid) => {
      let ref = "";
      let displayName = "";

      if (typeof actorOrUuid === "string") {
        ref = actorOrUuid.trim();
        const actor = game.actors?.get(ref);
        if (actor) {
          displayName = actor.name || "";
        } else if (ref && typeof fromUuidSync === "function") {
          try {
            const doc = fromUuidSync(ref);
            displayName = doc?.name || doc?.actor?.name || "";
          } catch {
            displayName = "";
          }
        }
      } else if (actorOrUuid && typeof actorOrUuid === "object") {
        ref = actorOrUuid.uuid || actorOrUuid.document?.uuid || actorOrUuid.id || "";
        displayName = actorOrUuid.name || actorOrUuid.actor?.name || "";
      }

      await setSetting("bossActorId", ref);
      if (ref) {
        ui.notifications?.info(t("Notifications.BossSetNotice", { name: displayName || ref }));
      } else {
        ui.notifications?.info(t("Notifications.BossClearedNotice"));
      }
      emitHudEvent("refresh", {}, { local: KorujaStreamHUD.shouldRender() });
      return ref;
    },

    setMode: async (mode) => {
      const resolved = normalizeOverlayMode(mode);
      if (!resolved) return getOverlayMode();
      await setSetting("overlayMode", resolved);
      const label = t(OVERLAY_MODE_I18N[resolved] || "OverlayModes.builtinTactical");
      ui.notifications?.info(t("Notifications.ModeChangedNotice", { mode: label }));
      emitHudEvent("refresh", {}, { local: KorujaStreamHUD.shouldRender() });
      return resolved;
    },

    setTheme: async (theme) => {
      const resolved = String(theme || "").trim().toLowerCase();
      if (!THEMES.includes(resolved)) return getTheme();
      await setSetting("theme", resolved);
      const label = t(`Themes.${resolved}`);
      ui.notifications?.info(t("Notifications.ThemeChangedNotice", { theme: label }));
      emitHudEvent("refresh", {}, { local: KorujaStreamHUD.shouldRender() });
      return resolved;
    },

    showLocation: (title, subtitle = "") => {
      if (!game.user?.isGM) return;
      const payload = {
        title: String(title || ""),
        subtitle: String(subtitle || "")
      };
      emitHudEvent("location-banner", payload, { local: KorujaStreamHUD.shouldRender() });
    },

    triggerBanner: (type = "crit", data = {}) => {
      if (!game.user?.isGM) return;
      const normalizedType = type === "fumble" ? "fumble" : "crit";
      emitHudEvent(
        "epic-banner",
        { type: normalizedType, ...data },
        { local: KorujaStreamHUD.shouldRender() }
      );
    }
  };
}

/* -------------------------------------------------------------------------- */
/* Foundry VTT Lifecycle Hooks                                                */
/* -------------------------------------------------------------------------- */

Hooks.once("init", () => {
  registerSettings(StreamPartyConfigApp, handleSettingsChange);

  initSocketBridge({
    onEpicBanner: (payload) => {
      if (!KorujaStreamHUD.shouldRender()) return;
      KorujaStreamHUD.showEpicBanner(payload?.type || "crit", payload || {});
    },
    onLocationBanner: (payload) => {
      if (!KorujaStreamHUD.shouldRender()) return;
      KorujaStreamHUD.showLocationBanner(payload || {});
    },
    onSpotlight: (payload) => {
      if (!KorujaStreamHUD.shouldRender()) return;
      if (payload?.hide) {
        KorujaStreamHUD.hideSpotlight();
      } else {
        KorujaStreamHUD.showSpotlight(payload || {});
      }
    },
    onRefresh: () => {
      if (KorujaStreamHUD.shouldRender()) {
        KorujaStreamHUD.render();
      }
    },
    onStateOverride: () => {
      if (KorujaStreamHUD.shouldRender()) {
        KorujaStreamHUD.render();
      }
    }
  });

  registerPublicApi();
});

Hooks.once("ready", () => {
  registerPublicApi();
  if (isStreamMode()) {
    KorujaStreamHUD.init();
  }
});

Hooks.on("canvasReady", () => {
  if (!KorujaStreamHUD.shouldRender()) return;
  KorujaStreamHUD.render();

  if (getSetting("autoLocationBanner") && canvas?.scene?.name) {
    const title = canvas.scene.navName || canvas.scene.name;
    const subtitle = getSetting("campaignTitle") || "";
    KorujaStreamHUD.showLocationBanner({ title, subtitle });
  }
});

/* -------------------------------------------------------------------------- */
/* Sidebar & Token HUD Controls (V12 / V13 / V14 compatible)                  */
/* -------------------------------------------------------------------------- */

Hooks.on("renderActorDirectory", (_app, html) => {
  if (!game.user?.isGM) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;

  if (root.querySelector(".koruja-hud-directory-actions")) return;

  const headerActions =
    root.querySelector(".directory-header .header-actions") ||
    root.querySelector(".header-actions") ||
    root.querySelector(".directory-header");
  if (!headerActions) return;

  const wrapper = document.createElement("div");
  wrapper.className = "koruja-hud-directory-actions";
  wrapper.style.display = "flex";
  wrapper.style.gap = "4px";
  wrapper.style.width = "100%";
  wrapper.style.marginTop = "4px";

  const configBtn = document.createElement("button");
  configBtn.type = "button";
  configBtn.className = "koruja-hud-dir-btn";
  configBtn.style.flex = "1";
  const configIcon = document.createElement("i");
  configIcon.className = "fas fa-tv";
  configBtn.append(configIcon, document.createTextNode(` ${t("ButtonLabel")}`));
  configBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    openConfigApp();
  });

  const modeBtn = document.createElement("button");
  modeBtn.type = "button";
  modeBtn.className = "koruja-hud-mode-btn";
  modeBtn.style.flex = "1";
  const modeIcon = document.createElement("i");
  modeIcon.className = "fas fa-theater-masks";
  modeBtn.append(modeIcon, document.createTextNode(` ${t("ModeToggleButton")}`));
  modeBtn.addEventListener("click", async (ev) => {
    ev.preventDefault();
    const current = getOverlayMode();
    const next = current === "builtin-roleplay" ? "builtin-tactical" : "builtin-roleplay";
    await game.korujaStreamHud?.setMode(next);
  });

  wrapper.append(configBtn, modeBtn);
  headerActions.appendChild(wrapper);
});

Hooks.on("renderTokenHUD", (app, html) => {
  if (!game.user?.isGM) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;

  if (root.querySelector("[data-action='koruja-boss-toggle']")) return;

  const tokenDoc = app?.object?.document || app?.document;
  const targetRef = tokenDoc?.uuid || app?.object?.actor?.id || "";
  if (!targetRef) return;

  const currentBoss = getSetting("bossActorId");
  const isBoss =
    Boolean(currentBoss) &&
    (currentBoss === targetRef || (tokenDoc?.actor?.id && currentBoss === tokenDoc.actor.id));

  const col = root.querySelector(".col.right") || root.querySelector(".col.left") || root;
  const btn = document.createElement("div");
  btn.className = `control-icon${isBoss ? " active" : ""}`;
  btn.dataset.action = "koruja-boss-toggle";
  btn.title = t("TokenHudBossToggle");
  btn.innerHTML = `<i class="fas fa-crown"></i>`;

  btn.addEventListener("click", async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (isBoss) {
      await game.korujaStreamHud?.setBoss("");
      btn.classList.remove("active");
    } else {
      const name = tokenDoc?.name || tokenDoc?.actor?.name || "Boss";
      await setSetting("bossActorId", targetRef);
      ui.notifications?.info(t("Notifications.BossSetNotice", { name }));
      emitHudEvent("refresh", {}, { local: KorujaStreamHUD.shouldRender() });
      btn.classList.add("active");
    }
  });

  col.appendChild(btn);
});

Hooks.on("renderImagePopout", (app) => {
  if (!getSetting("cinematicHandouts")) return;
  const img = app?.object?.src || app?.options?.src || app?.document?.src || "";
  if (!img) return;
  const title = app?.options?.title || app?.title || "";

  if (game.user?.isGM) {
    emitHudEvent("spotlight", { img, title }, { local: KorujaStreamHUD.shouldRender() });
  } else if (KorujaStreamHUD.shouldRender()) {
    KorujaStreamHUD.showSpotlight({ img, title });
  }
});

/* -------------------------------------------------------------------------- */
/* Reactive Data & Combat Hooks                                               */
/* -------------------------------------------------------------------------- */

function refreshIfActive() {
  if (KorujaStreamHUD.shouldRender()) {
    KorujaStreamHUD.render();
  }
}

Hooks.on("updateActor", refreshIfActive);
Hooks.on("updateToken", refreshIfActive);
Hooks.on("createActiveEffect", refreshIfActive);
Hooks.on("deleteActiveEffect", refreshIfActive);
Hooks.on("updateActiveEffect", refreshIfActive);
Hooks.on("updateScene", refreshIfActive);
Hooks.on("updatePlaylist", refreshIfActive);
Hooks.on("updatePlaylistSound", refreshIfActive);
Hooks.on("pauseGame", refreshIfActive);

Hooks.on("updateCombat", (combat, changed) => {
  if (!KorujaStreamHUD.shouldRender()) return;
  KorujaStreamHUD.render();

  if (
    changed &&
    ("turn" in changed || "round" in changed || "started" in changed)
  ) {
    panToActiveCombatant(combat);
  }
});

Hooks.on("deleteCombat", refreshIfActive);

Hooks.on("createChatMessage", (message) => {
  if (!KorujaStreamHUD.shouldRender()) return;

  KorujaStreamHUD.pushChatMessage(message);

  const rollInfo = analyzeChatRoll(message);
  if (rollInfo.isRoll && rollInfo.actorId) {
    KorujaStreamHUD.triggerRollToast(rollInfo.actorId, rollInfo);
  }

  if (rollInfo.isRoll && (rollInfo.isCrit || rollInfo.isFumble)) {
    const actor = rollInfo.actorId ? game.actors?.get(rollInfo.actorId) : null;
    KorujaStreamHUD.showEpicBanner(
      rollInfo.bannerType || (rollInfo.isCrit ? "crit" : "fumble"),
      {
        actorName: rollInfo.actorName || "",
        actorImg: actor?.img || "",
        total: rollInfo.total
      }
    );
  }

  KorujaStreamHUD.render();
});
