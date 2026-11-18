import {
  MODULE_ID,
  I18N_PREFIX,
  DEFAULT_POSITIONS,
  ROLEPLAY_POSITIONS,
  escapeHtml
} from "./constants.js";
import {
  extractActorData,
  extractBossData,
  analyzeChatRoll
} from "./system-adapter.js";
import {
  getSetting,
  isStreamMode,
  getOverlayMode,
  getTheme
} from "./settings.js";

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
 * Resolve an Actor or TokenDocument from a stored bossActorId (ID or UUID).
 * @param {string} ref
 * @returns {Actor|TokenDocument|null}
 */
function resolveBossTarget(ref) {
  if (!ref) return null;
  const direct = game.actors?.get?.(ref);
  if (direct) return direct;
  try {
    if (typeof fromUuidSync === "function") {
      const doc = fromUuidSync(ref);
      if (doc) return doc;
    }
  } catch {
    // Ignore invalid UUIDs
  }
  return null;
}

/**
 * Format current wall-clock time for tactical top bar.
 * @returns {string}
 */
function formatClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Compute scene darkness percentage for tactical lighting pill.
 * @returns {number}
 */
function getSceneLightPct() {
  const scene = game.scenes?.active;
  const darkness = Number(scene?.environment?.darknessLevel ?? scene?.darkness ?? 0);
  const clamped = Math.max(0, Math.min(1, Number.isFinite(darkness) ? darkness : 0));
  return Math.round((1 - clamped) * 100);
}

/**
 * Compute simulated BPM & ECG waveform SVG for tactical theme.
 * @param {object} data
 * @returns {string}
 */
function renderTacticalEcg(data) {
  const pct = data.primary?.pct ?? 100;
  let bpm = 72;
  let stateClass = "ecg-normal";
  if (data.isDead || pct <= 0) {
    bpm = 0;
    stateClass = "ecg-flat";
  } else if (data.isCritical || pct <= 25) {
    bpm = 158;
    stateClass = "ecg-critical";
  } else if (data.isBloodied || pct <= 50) {
    bpm = 124;
    stateClass = "ecg-elevated";
  }

  const path =
    bpm === 0
      ? "M0,12 L80,12"
      : "M0,12 L16,12 L22,12 L26,4 L31,20 L36,2 L41,17 L45,12 L62,12 L67,8 L72,12 L80,12";

  return `
    <div class="ksh-ecg-row ${stateClass}">
      <svg class="ksh-ecg-svg" viewBox="0 0 80 24" preserveAspectRatio="none" aria-hidden="true">
        <path d="${path}" />
      </svg>
      <span class="ksh-bpm-label">${bpm} BPM</span>
    </div>
  `;
}

/**
 * Persistent Media Layer + 1920x1080 Stream HUD Renderer.
 */
export class KorujaStreamHUD {
  static container = null;
  static mediaLayer = null;
  static lastMediaSig = "";
  static hpCache = new Map();
  static rollTimers = new Map();
  static rollToasts = new Map();
  static chatHistory = [];
  static epicBannerEl = null;
  static epicBannerTimer = null;
  static locationBannerEl = null;
  static locationBannerTimer = null;
  static spotlightEl = null;
  static spotlightTimer = null;
  static autoCenterTimer = null;
  static lastBossHpPct = null;

  static shouldRender() {
    return isStreamMode();
  }

  static init() {
    if (!this.shouldRender()) {
      this.destroy();
      return;
    }

    const hideUI = Boolean(getSetting("hideFoundryUI"));
    document.body.classList.toggle("koruja-stream-mode-active", hideUI);

    if (!this.mediaLayer) {
      this.mediaLayer = document.createElement("div");
      this.mediaLayer.id = "koruja-media-layer";
      document.body.appendChild(this.mediaLayer);
    }

    if (!this.container) {
      this.container = document.createElement("div");
      this.container.id = "koruja-stream-hud";
      document.body.appendChild(this.container);
    }

    this.loadRecentMessages();
    this.render();
    this.startAutoCenterTimer();
  }

  static destroy() {
    document.body.classList.remove("koruja-stream-mode-active", "koruja-stream-roleplay-mode");
    if (this.autoCenterTimer) {
      clearInterval(this.autoCenterTimer);
      this.autoCenterTimer = null;
    }
    if (this.epicBannerTimer) clearTimeout(this.epicBannerTimer);
    if (this.locationBannerTimer) clearTimeout(this.locationBannerTimer);
    if (this.spotlightTimer) clearTimeout(this.spotlightTimer);
    for (const timer of this.rollTimers.values()) clearTimeout(timer);
    this.rollTimers.clear();
    this.rollToasts.clear();

    this.epicBannerEl?.remove();
    this.epicBannerEl = null;
    this.locationBannerEl?.remove();
    this.locationBannerEl = null;
    this.spotlightEl?.remove();
    this.spotlightEl = null;

    if (this.mediaLayer) {
      this.mediaLayer.remove();
      this.mediaLayer = null;
      this.lastMediaSig = "";
    }
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  static startAutoCenterTimer() {
    if (this.autoCenterTimer) {
      clearInterval(this.autoCenterTimer);
      this.autoCenterTimer = null;
    }
    if (!this.shouldRender()) return;
    const sec = Number(getSetting("autoCenterInterval")) || 0;
    if (sec <= 0) return;
    this.autoCenterTimer = setInterval(() => this.recenterCamera(), sec * 1000);
  }

  static recenterCamera() {
    if (!this.shouldRender() || !canvas?.ready) return;
    if (getOverlayMode() === "builtin-roleplay") return;

    if (game.combat?.started && game.combat.combatant) {
      const token = game.combat.combatant.token?.object;
      if (token && !game.combat.combatant.hidden && !token.document?.hidden) {
        canvas.animatePan({ x: token.center.x, y: token.center.y, duration: 900 });
        return;
      }
    }

    const actorIds = getSetting("partyActorIds") || [];
    const partyTokens =
      canvas.tokens?.placeables?.filter(
        (tok) => !tok.document?.hidden && actorIds.includes(tok.actor?.id)
      ) || [];

    if (partyTokens.length > 0) {
      const avgX = partyTokens.reduce((sum, tok) => sum + tok.center.x, 0) / partyTokens.length;
      const avgY = partyTokens.reduce((sum, tok) => sum + tok.center.y, 0) / partyTokens.length;
      canvas.animatePan({ x: avgX, y: avgY, duration: 900 });
      return;
    }

    const initView = canvas.scene?.initial;
    if (initView?.x != null && initView?.y != null) {
      canvas.animatePan({ x: initView.x, y: initView.y, scale: initView.scale, duration: 900 });
    }
  }

  static loadRecentMessages() {
    const publicMsgs = (game.messages?.contents || [])
      .filter((m) => !m.blind && (!m.whisper || m.whisper.length === 0))
      .slice(-5);
    this.chatHistory = publicMsgs.map((m) => this.#formatChatMessage(m)).filter(Boolean);
  }

  static pushChatMessage(message) {
    if (!message || message.blind || (message.whisper && message.whisper.length > 0)) return;
    const entry = this.#formatChatMessage(message);
    if (!entry) return;
    this.chatHistory.push(entry);
    if (this.chatHistory.length > 5) {
      this.chatHistory = this.chatHistory.slice(-5);
    }
  }

  static #formatChatMessage(message) {
    const author = message.speaker?.alias || message.author?.name || "Player";
    const rollInfo = analyzeChatRoll(message);
    if (rollInfo.isRoll) {
      const outcomeClass = rollInfo.isCrit ? "crit" : rollInfo.isFumble ? "fumble" : "";
      const badge = rollInfo.isCrit
        ? ` ★ ${t("Alerts.SuccessLabel")}`
        : rollInfo.isFumble
          ? ` ✕ ${t("Alerts.FailureLabel")}`
          : "";
      const formulaHtml = rollInfo.formula
        ? ` <span class="roll-sub">(${escapeHtml(rollInfo.formula)})${escapeHtml(badge)}</span>`
        : "";
      return {
        author,
        html: `🎲 <strong>${escapeHtml(rollInfo.total ?? "")}</strong>${formulaHtml}`,
        type: outcomeClass
      };
    }

    const temp = document.createElement("div");
    temp.innerHTML = message.content || "";
    const plain = temp.textContent?.trim();
    if (!plain) return null;
    const truncated = plain.length > 90 ? `${plain.slice(0, 87)}...` : plain;
    return { author, html: escapeHtml(truncated), type: "" };
  }

  static triggerRollToast(actorId, rollInfo) {
    if (!actorId || !getSetting("showRolls")) return;
    if (this.rollTimers.has(actorId)) {
      clearTimeout(this.rollTimers.get(actorId));
    }
    this.rollToasts.set(actorId, {
      total: rollInfo.total ?? "",
      formula: rollInfo.formula || "",
      flavor: rollInfo.flavor || "",
      isCrit: Boolean(rollInfo.isCrit),
      isFumble: Boolean(rollInfo.isFumble)
    });
    this.render();

    const timer = setTimeout(() => {
      this.rollToasts.delete(actorId);
      this.rollTimers.delete(actorId);
      if (this.shouldRender()) this.render();
    }, 6000);
    this.rollTimers.set(actorId, timer);
  }

  static getCurrentTrackHtml() {
    if (!getSetting("showMusicTracker")) return "";
    const playingSounds = [];
    for (const pl of game.playlists?.contents || []) {
      if (!pl.playing) continue;
      for (const s of pl.sounds?.contents || []) {
        if (s.playing) playingSounds.push({ name: s.name, channel: pl.channel || "music" });
      }
    }
    if (playingSounds.length === 0) return "";
    const track = playingSounds.find((s) => s.channel === "music") || playingSounds[0];
    return `
      <div class="koruja-music-pill" title="${escapeHtml(t("HUD.MusicLabel"))}">
        <span class="music-bars"><i></i><i></i><i></i></span>
        <span class="music-label">♪ ${escapeHtml(track.name)}</span>
      </div>
    `;
  }

  static #syncMediaLayer(actors, overlayMode, pos) {
    if (!this.mediaLayer) return;
    const slotConfigs = getSetting("playerSlotConfigs") || {};
    const isRoleplay = overlayMode === "builtin-roleplay";
    const descriptors = actors.map((actor, index) => {
      const slotKey = `p${index + 1}`;
      const coords = pos[slotKey] || DEFAULT_POSITIONS[slotKey];
      const sc = slotConfigs[actor.id] || { mode: "transparent", url: "" };
      const camBox = isRoleplay
        ? { x: coords.x, y: coords.y - 252, w: 440, h: 248 }
        : { x: coords.x, y: coords.y - 110, w: 222, h: 106 };
      return {
        actorId: actor.id,
        name: actor.name,
        img: actor.img,
        mode: sc.mode || "transparent",
        url: (sc.url || "").trim(),
        camBox
      };
    });

    const sig = JSON.stringify(descriptors);
    if (sig === this.lastMediaSig) return;
    this.lastMediaSig = sig;

    this.mediaLayer.innerHTML = descriptors
      .map((d) => {
        const style = `left:${d.camBox.x}px; top:${d.camBox.y}px; width:${d.camBox.w}px; height:${d.camBox.h}px;`;
        if (d.mode === "iframe" && d.url) {
          return `
            <div class="ksh-media-slot is-iframe" style="${style}">
              <iframe src="${escapeHtml(d.url)}" allow="camera; microphone; autoplay; display-capture; fullscreen" allowfullscreen loading="eager"></iframe>
            </div>
          `;
        }
        if (d.mode === "portrait" && d.img) {
          return `
            <div class="ksh-media-slot is-portrait" style="${style}">
              <img src="${escapeHtml(d.img)}" alt="${escapeHtml(d.name)}" />
            </div>
          `;
        }
        return `<div class="ksh-media-slot is-transparent" style="${style}"></div>`;
      })
      .join("");
  }

  static render(flashEvents = {}) {
    if (!this.shouldRender()) {
      this.destroy();
      return;
    }
    if (!this.container) this.init();

    const theme = getTheme();
    const overlayMode = getOverlayMode();
    const isRoleplayMode = overlayMode === "builtin-roleplay";

    document.body.classList.toggle("koruja-stream-roleplay-mode", isRoleplayMode);
    this.container.className = `theme-${theme} mode-${overlayMode}${isRoleplayMode ? " is-roleplay-mode" : ""}`;

    const customOverlayImg = getSetting("customOverlayImg") || "";
    const showPrimary = Boolean(getSetting("showPrimaryBar"));
    const showSecondary = Boolean(getSetting("showSecondaryBar"));
    const showTertiary = Boolean(getSetting("showTertiaryBar"));
    const showDefense = Boolean(getSetting("showDefense"));
    const showConditions = Boolean(getSetting("showConditions"));
    const showChatFeed = Boolean(getSetting("showChatFeed"));
    const showCombatBox = isRoleplayMode ? false : Boolean(getSetting("showCombatBox"));
    const showQuestBox = Boolean(getSetting("showQuestBox"));
    const bossRef = getSetting("bossActorId") || "";

    const pos = isRoleplayMode
      ? foundry.utils.deepClone(ROLEPLAY_POSITIONS)
      : foundry.utils.mergeObject(
          foundry.utils.deepClone(DEFAULT_POSITIONS),
          foundry.utils.deepClone(getSetting("cardPositions") || {})
        );

    const actorIds = getSetting("partyActorIds") || [];
    const actors = actorIds
      .slice(0, 6)
      .map((id) => game.actors?.get?.(id))
      .filter(Boolean);

    this.#syncMediaLayer(actors, overlayMode, pos);

    const activeCombatant = game.combat?.started ? game.combat.combatant : null;
    const activeCombatantActorId = activeCombatant?.actor?.id || null;

    // 1. Top Bar & Frame Backdrop
    const titleText =
      (getSetting("campaignTitle") || "").trim() ||
      game.scenes?.active?.name ||
      game.world?.title ||
      "KORUJA STREAM HUD";
    const subtitleText = (getSetting("campaignSubtitle") || "").trim();
    const musicHtml = this.getCurrentTrackHtml();
    const tacticalMetaHtml =
      theme === "tactical"
        ? `<span class="ksh-meta-pill">LUX ${getSceneLightPct()}%</span><span class="ksh-meta-pill">${formatClock()}</span>`
        : "";
    const liveBadgeHtml = game.paused
      ? `<span class="ksh-live-badge is-paused"><span class="live-dot"></span> ${escapeHtml(t("HUD.PausedBadge"))}</span>`
      : `<span class="ksh-live-badge"><span class="live-dot"></span> ${escapeHtml(t("HUD.LiveRec"))}</span>`;

    const topBarHtml = `
      <div class="koruja-top-bar">
        <div class="top-left">
          <span class="ksh-brand-glyph" aria-hidden="true">◆</span>
          <span class="ksh-campaign-title">${escapeHtml(titleText)}</span>
          ${subtitleText ? `<span class="ksh-campaign-sub">${escapeHtml(subtitleText)}</span>` : ""}
        </div>
        <div class="top-center">${musicHtml}</div>
        <div class="top-right">
          ${tacticalMetaHtml}
          ${liveBadgeHtml}
        </div>
      </div>
    `;

    let backdropHtml = "";
    if (overlayMode === "builtin-tactical") {
      const cutouts = ["p1", "p2", "p3", "p4", "p5", "p6"]
        .map((k) => {
          const p = pos[k] || DEFAULT_POSITIONS[k];
          return `<div class="koruja-cutout koruja-cutout-player" style="left:${p.x}px; top:${p.y - 110}px; width:222px; height:106px;"></div>`;
        })
        .join("");
      backdropHtml = `
        <div class="koruja-builtin-frame">
          ${topBarHtml}
          <div class="koruja-cutout koruja-cutout-foundry"></div>
          <div class="koruja-cutout koruja-cutout-gm">
            <span class="ksh-cutout-label">${escapeHtml(t("HUD.GmLabel"))}</span>
          </div>
          ${cutouts}
        </div>
      `;
    } else if (overlayMode === "builtin-roleplay") {
      const rpCutouts = ["p1", "p2", "p3", "p4", "p5", "p6"]
        .map((k) => {
          const p = pos[k] || ROLEPLAY_POSITIONS[k];
          return `<div class="koruja-cutout koruja-cutout-rp" style="left:${p.x}px; top:${p.y - 252}px; width:440px; height:248px;"></div>`;
        })
        .join("");
      backdropHtml = `
        <div class="koruja-builtin-frame is-roleplay">
          ${topBarHtml}
          <div class="koruja-cutout koruja-cutout-gm-rp">
            <span class="ksh-cutout-label">${escapeHtml(t("HUD.GmLabel"))}</span>
          </div>
          ${rpCutouts}
          <div class="koruja-rp-footer">
            <span class="rp-title">${escapeHtml(titleText)}</span>
            ${subtitleText ? `<span class="rp-sep">•</span><span class="rp-sub">${escapeHtml(subtitleText)}</span>` : ""}
          </div>
        </div>
      `;
    } else if (overlayMode === "custom-image") {
      backdropHtml = `
        ${customOverlayImg ? `<img class="koruja-custom-overlay-bg" src="${escapeHtml(customOverlayImg)}" alt="" />` : ""}
        ${topBarHtml}
      `;
    } else {
      backdropHtml = topBarHtml;
    }

    // 2. Player Cards (up to 6)
    const playerCardsHtml = actors
      .map((actor, index) => {
        const data = extractActorData(actor);
        const slotKey = `p${index + 1}`;
        const coords = pos[slotKey] || DEFAULT_POSITIONS[slotKey];
        const isTurn = activeCombatantActorId === actor.id;

        const prevPrimary = this.hpCache.get(actor.id);
        const curVal = data.primary?.value ?? 0;
        let flashClass = flashEvents[actor.id] || "";
        if (!flashClass && prevPrimary !== undefined && prevPrimary !== curVal) {
          flashClass = curVal < prevPrimary ? "flash-damage" : "flash-heal";
        }
        this.hpCache.set(actor.id, curVal);

        const bar1Html =
          showPrimary && data.primary?.hasData
            ? this.#renderResourceBar(data.primary, "primary", data.isBloodied, data.isCritical)
            : "";
        const bar2Html =
          showSecondary && data.secondary?.hasData
            ? this.#renderResourceBar(data.secondary, "secondary", false, false)
            : "";
        const bar3Html =
          showTertiary && data.tertiary?.hasData
            ? this.#renderResourceBar(data.tertiary, "tertiary", false, false)
            : "";

        const deathSavesHtml =
          data.deathSaves && (data.primary?.value ?? 1) <= 0
            ? this.#renderDeathSaves(data.deathSaves)
            : "";

        const ecgHtml = theme === "tactical" ? renderTacticalEcg(data) : "";

        const defPillHtml =
          showDefense && data.defense?.value !== null && data.defense?.value !== undefined
            ? `<span class="ksh-pill ksh-def-pill">${escapeHtml(data.defense.label || t("HUD.DefenseLabel"))} ${escapeHtml(data.defense.value)}</span>`
            : "";
        const lvlPillHtml =
          data.level?.value !== null && data.level?.value !== undefined
            ? `<span class="ksh-pill ksh-lvl-pill">${escapeHtml(t("HUD.LevelLabel", { level: data.level.value }))}</span>`
            : "";

        const badgesHtml = [
          data.inspiration
            ? `<span class="ksh-badge ksh-badge-inspired">${escapeHtml(t("HUD.InspiredBadge"))}</span>`
            : "",
          data.concentrating
            ? `<span class="ksh-badge ksh-badge-conc">${escapeHtml(t("HUD.ConcentratingBadge"))}</span>`
            : ""
        ]
          .filter(Boolean)
          .join("");

        const effectsHtml =
          showConditions && data.conditions?.length
            ? `<div class="ksh-effects-row">${data.conditions
                .slice(0, 5)
                .map(
                  (c) =>
                    `<img class="ksh-effect-icon" src="${escapeHtml(c.img)}" title="${escapeHtml(c.name)}" alt="${escapeHtml(c.name)}" />`
                )
                .join("")}</div>`
            : "";

        const toast = this.rollToasts.get(actor.id);
        const toastHtml = toast
          ? `
            <div class="ksh-roll-toast ${toast.isCrit ? "is-crit" : toast.isFumble ? "is-fumble" : ""}">
              <span class="toast-label">${escapeHtml(toast.flavor || t("Alerts.RollToastLabel"))}</span>
              <strong class="toast-total">${escapeHtml(toast.total)}</strong>
            </div>
          `
          : "";

        const stateClasses = [
          "koruja-player-card",
          isTurn ? "is-active-turn" : "",
          data.isBloodied ? "is-bloodied" : "",
          data.isCritical ? "is-critical" : "",
          data.isDead ? "is-dead" : "",
          flashClass
        ]
          .filter(Boolean)
          .join(" ");

        return `
          <div class="${stateClasses}" data-actor-id="${escapeHtml(actor.id)}" style="left:${coords.x}px; top:${coords.y}px;">
            ${isTurn ? `<div class="ksh-turn-badge">${escapeHtml(t("HUD.TurnBadge"))}</div>` : ""}
            ${toastHtml}
            <div class="ksh-card-header">
              <div class="ksh-portrait-wrap">
                <img class="ksh-portrait" src="${escapeHtml(data.img)}" alt="${escapeHtml(data.name)}" />
                ${data.isDead ? `<span class="ksh-dead-stamp">${escapeHtml(t("HUD.DeadLabel"))}</span>` : ""}
              </div>
              <div class="ksh-card-meta">
                <div class="ksh-name-row">
                  <span class="ksh-actor-name">${escapeHtml(data.name)}</span>
                  ${badgesHtml}
                </div>
                <div class="ksh-pills-row">
                  ${defPillHtml}
                  ${lvlPillHtml}
                </div>
              </div>
            </div>
            <div class="ksh-bars-stack">
              ${deathSavesHtml || bar1Html}
              ${bar2Html}
              ${bar3Html}
            </div>
            ${ecgHtml}
            ${effectsHtml}
          </div>
        `;
      })
      .join("");

    // 3. Boss / Priority Threat Bar
    const bossHtml = this.#renderBossBar(bossRef);

    // 4. Chat & Rolls Feed
    const chatPos = pos.chat || DEFAULT_POSITIONS.chat;
    const chatHtml = showChatFeed ? this.#renderChatFeed(chatPos) : "";

    // 5. Combat Box
    const combatPos = pos.combat || DEFAULT_POSITIONS.combat;
    const combatHtml = showCombatBox ? this.#renderCombatBox(combatPos) : "";

    // 6. Quest Box
    const questText = (getSetting("customQuestText") || "").trim();
    const questHtml =
      showQuestBox && questText
        ? `
          <div class="koruja-quest-box">
            <div class="ksh-widget-title">${escapeHtml(t("HUD.QuestTitle"))}</div>
            <div class="ksh-quest-body">${escapeHtml(questText)}</div>
          </div>
        `
        : "";

    // 7. Pause Overlay
    const pauseHtml = game.paused
      ? `
        <div class="koruja-pause-overlay">
          <div class="ksh-pause-card">
            <div class="ksh-pause-title">${escapeHtml(t("HUD.PausedTitle"))}</div>
            <div class="ksh-pause-sub">${escapeHtml(t("HUD.PausedSub"))}</div>
          </div>
        </div>
      `
      : "";

    this.container.innerHTML = `
      ${backdropHtml}
      ${bossHtml}
      ${questHtml}
      ${playerCardsHtml}
      ${chatHtml}
      ${combatHtml}
      ${pauseHtml}
    `;
  }

  static #renderResourceBar(bar, kind, isBloodied, isCritical) {
    const pct = Math.max(0, Math.min(100, Number(bar.pct ?? 0)));
    const stateClass =
      kind === "primary"
        ? isCritical
          ? "is-critical"
          : isBloodied
            ? "is-bloodied"
            : "is-healthy"
        : `is-${kind}`;
    const tempHtml =
      bar.temp && bar.temp > 0
        ? `<span class="ksh-temp-hp">${escapeHtml(t("HUD.TempHpLabel", { temp: bar.temp }))}</span>`
        : "";
    const thresholdHtml =
      bar.threshold != null && bar.max > 0
        ? `<div class="ksh-bar-threshold" style="left:${Math.max(0, Math.min(100, (bar.threshold / bar.max) * 100))}%;"></div>`
        : "";

    return `
      <div class="ksh-resource-bar ${stateClass}">
        <div class="ksh-bar-track">
          <div class="ksh-bar-fill" style="width:${pct}%;"></div>
          ${thresholdHtml}
        </div>
        <div class="ksh-bar-text">
          <span class="ksh-bar-label">${escapeHtml(bar.label || "")}</span>
          <span class="ksh-bar-nums">${escapeHtml(bar.value)}/${escapeHtml(bar.max)} ${tempHtml}</span>
        </div>
      </div>
    `;
  }

  static #renderDeathSaves(ds) {
    const succ = Array.from({ length: 3 }, (_, i) =>
      `<i class="ds-pip is-success ${i < (ds.success || 0) ? "is-filled" : ""}"></i>`
    ).join("");
    const fail = Array.from({ length: 3 }, (_, i) =>
      `<i class="ds-pip is-failure ${i < (ds.failure || 0) ? "is-filled" : ""}"></i>`
    ).join("");
    return `
      <div class="ksh-death-saves">
        <span class="ds-label">${escapeHtml(t("HUD.UnconsciousLabel"))}</span>
        <span class="ds-group">${succ}</span>
        <span class="ds-group">${fail}</span>
      </div>
    `;
  }

  static #renderBossBar(bossRef) {
    const target = resolveBossTarget(bossRef);
    if (!target) {
      this.lastBossHpPct = null;
      return "";
    }
    const boss = extractBossData(target);
    const pct = Math.max(0, Math.min(100, Number(boss.hp?.pct ?? 100)));
    const prevPct = this.lastBossHpPct ?? pct;
    const trailPct = Math.max(pct, prevPct);
    this.lastBossHpPct = pct;

    return `
      <div class="koruja-boss-bar ${boss.isDead ? "is-dead" : ""}">
        <div class="ksh-boss-header">
          <span class="ksh-boss-tag">${escapeHtml(t("HUD.BossLabel"))}</span>
          <span class="ksh-boss-name">${escapeHtml(boss.name)}</span>
          <span class="ksh-boss-nums">${escapeHtml(boss.hp?.value ?? 0)} / ${escapeHtml(boss.hp?.max ?? 0)}</span>
        </div>
        <div class="ksh-boss-track">
          <div class="ksh-boss-trail" style="width:${trailPct}%;"></div>
          <div class="ksh-boss-fill" style="width:${pct}%;"></div>
        </div>
      </div>
    `;
  }

  static #renderChatFeed(pos) {
    const itemsHtml =
      this.chatHistory.length > 0
        ? this.chatHistory
            .map(
              (m) => `
                <div class="ksh-chat-item ${escapeHtml(m.type)}">
                  <span class="ksh-chat-author">${escapeHtml(m.author)}:</span>
                  <span class="ksh-chat-text">${m.html}</span>
                </div>
              `
            )
            .join("")
        : `<div class="ksh-empty-note">${escapeHtml(t("HUD.NoMessages"))}</div>`;

    return `
      <div class="koruja-chat-feed-box" style="left:${pos.x}px; top:${pos.y}px;">
        <div class="ksh-widget-title">${escapeHtml(t("HUD.ChatFeedTitle"))}</div>
        <div class="ksh-chat-list">${itemsHtml}</div>
      </div>
    `;
  }

  static #renderCombatBox(pos) {
    const combat = game.combat;
    if (!combat?.started) {
      return `
        <div class="koruja-combat-box is-idle" style="left:${pos.x}px; top:${pos.y}px;">
          <div class="ksh-widget-title">${escapeHtml(t("HUD.CombatTitle"))}</div>
          <div class="ksh-empty-note">${escapeHtml(t("HUD.NoCombat"))}</div>
        </div>
      `;
    }

    const roundLabel = t("HUD.RoundLabel", { round: combat.round || 1 });
    const current = combat.combatant;
    const turns = combat.turns || [];
    let nextName = "";
    if (turns.length > 1) {
      const idx = turns.findIndex((c) => c.id === current?.id);
      for (let step = 1; step < turns.length; step++) {
        const candidate = turns[(idx + step) % turns.length];
        if (candidate && !candidate.hidden && !candidate.isDefeated) {
          nextName = candidate.name || "";
          break;
        }
      }
    }

    return `
      <div class="koruja-combat-box is-active" style="left:${pos.x}px; top:${pos.y}px;">
        <div class="ksh-combat-top">
          <span class="ksh-widget-title">${escapeHtml(t("HUD.CombatTitle"))}</span>
          <span class="ksh-round-pill">${escapeHtml(roundLabel)}</span>
        </div>
        <div class="ksh-combat-current">
          ${current?.img ? `<img src="${escapeHtml(current.img)}" alt="${escapeHtml(current.name)}" />` : ""}
          <span>${escapeHtml(current?.name || "—")}</span>
        </div>
        ${nextName ? `<div class="ksh-combat-next">${escapeHtml(t("HUD.NextTurn", { name: nextName }))}</div>` : ""}
      </div>
    `;
  }

  static showEpicBanner(type = "crit", data = {}) {
    if (!this.shouldRender()) return;
    if (!this.container) this.init();
    if (this.epicBannerTimer) clearTimeout(this.epicBannerTimer);
    this.epicBannerEl?.remove();

    const isFumble = type === "fumble";
    const actorName = data.actorName || data.name || "Player";
    const title =
      data.title || (isFumble ? t("Alerts.FumbleTitle") : t("Alerts.CritTitle"));
    const subtitle =
      data.subtitle ||
      (isFumble
        ? t("Alerts.FumbleSubtitle", { actor: actorName })
        : t("Alerts.CritSubtitle", { actor: actorName }));

    const el = document.createElement("div");
    el.className = `koruja-epic-banner ${isFumble ? "is-fumble" : "is-crit"}`;
    el.innerHTML = `
      ${data.actorImg || data.img ? `<img class="ksh-epic-img" src="${escapeHtml(data.actorImg || data.img)}" alt="" />` : ""}
      <div class="ksh-epic-copy">
        <div class="ksh-epic-title">${escapeHtml(title)}</div>
        <div class="ksh-epic-sub">${escapeHtml(subtitle)}</div>
      </div>
      ${data.total != null ? `<div class="ksh-epic-total">${escapeHtml(data.total)}</div>` : ""}
    `;
    this.container.appendChild(el);
    this.epicBannerEl = el;

    this.epicBannerTimer = setTimeout(() => {
      el.classList.add("is-fading");
      setTimeout(() => el.remove(), 400);
      if (this.epicBannerEl === el) this.epicBannerEl = null;
    }, 4500);
  }

  static showLocationBanner(data = {}) {
    if (!this.shouldRender()) return;
    if (!this.container) this.init();
    if (this.locationBannerTimer) clearTimeout(this.locationBannerTimer);
    this.locationBannerEl?.remove();

    const title = data.title || game.scenes?.active?.name || "";
    if (!title) return;
    const subtitle = data.subtitle || getSetting("campaignSubtitle") || "";

    const el = document.createElement("div");
    el.className = "koruja-location-banner";
    el.innerHTML = `
      <div class="ksh-loc-prefix">${escapeHtml(t("Alerts.LocationPrefix"))}</div>
      <div class="ksh-loc-title">${escapeHtml(title)}</div>
      ${subtitle ? `<div class="ksh-loc-sub">${escapeHtml(subtitle)}</div>` : ""}
    `;
    this.container.appendChild(el);
    this.locationBannerEl = el;

    this.locationBannerTimer = setTimeout(() => {
      el.classList.add("is-fading");
      setTimeout(() => el.remove(), 450);
      if (this.locationBannerEl === el) this.locationBannerEl = null;
    }, 5500);
  }

  static showSpotlight(data = {}) {
    if (!this.shouldRender() || !data.img) return;
    if (!this.container) this.init();
    if (this.spotlightTimer) clearTimeout(this.spotlightTimer);
    this.spotlightEl?.remove();

    const el = document.createElement("div");
    el.className = "koruja-spotlight-overlay";
    el.innerHTML = `
      <div class="ksh-spotlight-frame">
        <div class="ksh-spotlight-tag">${escapeHtml(t("HUD.HandoutLabel"))}</div>
        <img src="${escapeHtml(data.img)}" alt="${escapeHtml(data.title || "")}" />
        ${data.title ? `<div class="ksh-spotlight-title">${escapeHtml(data.title)}</div>` : ""}
      </div>
    `;
    this.container.appendChild(el);
    this.spotlightEl = el;

    const duration = Number(data.durationMs) || 12000;
    this.spotlightTimer = setTimeout(() => this.hideSpotlight(), duration);
  }

  static hideSpotlight() {
    if (this.spotlightTimer) {
      clearTimeout(this.spotlightTimer);
      this.spotlightTimer = null;
    }
    if (this.spotlightEl) {
      this.spotlightEl.remove();
      this.spotlightEl = null;
    }
  }
}
