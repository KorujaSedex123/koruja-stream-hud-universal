import {
  MODULE_ID,
  I18N_PREFIX,
  THEMES,
  OVERLAY_MODES,
  DEFAULT_POSITIONS,
  escapeHtml,
  sanitizeUrl
} from "./constants.js";
import {
  PRESET_IDS,
  getActiveMapping,
  testActorMapping
} from "./system-adapter.js";
import {
  getSetting,
  setSetting,
  buildVdoLinks
} from "./settings.js";
import { emitHudEvent } from "./socket.js";
import { KorujaStreamHUD } from "./hud-renderer.js";

/**
 * Check whether a parsed JSON value is a plain non-array object.
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

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

const OVERLAY_I18N_MAP = {
  "builtin-tactical": "OverlayModes.builtinTactical",
  "builtin-roleplay": "OverlayModes.builtinRoleplay",
  "custom-image": "OverlayModes.customImage",
  none: "OverlayModes.none"
};

/**
 * Universal Stream HUD Configuration Application (Foundry ApplicationV2).
 */
export class StreamPartyConfigApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "koruja-stream-hud-config",
    tag: "form",
    window: {
      title: "KORUJA_HUD.Config.Title",
      icon: "fa-solid fa-video",
      resizable: true
    },
    position: {
      width: 900,
      height: "auto"
    },
    form: {
      handler: StreamPartyConfigApp.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: true
    }
  };

  #draftPositions = null;
  #activeTab = "party";

  async _prepareContext() {
    const mapping = getActiveMapping();
    const partyTypes = new Set(mapping.partyActorTypes || []);
    const bossTypes = new Set(mapping.bossActorTypes || []);

    const allActors = [...(game.actors?.contents || [])].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    const partyActors =
      partyTypes.size > 0
        ? allActors.filter((a) => partyTypes.has(a.type))
        : allActors;
    const bossActors =
      bossTypes.size > 0
        ? allActors.filter((a) => bossTypes.has(a.type))
        : allActors;

    const savedPositions = getSetting("cardPositions") || {};
    this.#draftPositions = foundry.utils.mergeObject(
      foundry.utils.deepClone(DEFAULT_POSITIONS),
      foundry.utils.deepClone(savedPositions)
    );

    const baseUrl = window.location.href.split("?")[0];
    return {
      partyActors: partyActors.length > 0 ? partyActors : allActors,
      bossActors: bossActors.length > 0 ? bossActors : allActors,
      selectedIds: getSetting("partyActorIds") || [],
      slotConfigs: getSetting("playerSlotConfigs") || {},
      vdoRoomName: getSetting("vdoRoomName") || "",
      systemPreset: getSetting("systemPreset") || "auto",
      customMappingJson: getSetting("customMappingJson") || "",
      theme: getSetting("theme") || "fantasy",
      overlayMode: getSetting("overlayMode") || "builtin-tactical",
      customOverlayImg: getSetting("customOverlayImg") || "",
      campaignTitle: getSetting("campaignTitle") || "",
      campaignSubtitle: getSetting("campaignSubtitle") || "",
      customQuestText: getSetting("customQuestText") || "",
      bossActorId: getSetting("bossActorId") || "",
      hideFoundryUI: Boolean(getSetting("hideFoundryUI")),
      showPrimaryBar: Boolean(getSetting("showPrimaryBar")),
      showSecondaryBar: Boolean(getSetting("showSecondaryBar")),
      showTertiaryBar: Boolean(getSetting("showTertiaryBar")),
      showDefense: Boolean(getSetting("showDefense")),
      showConditions: Boolean(getSetting("showConditions")),
      showRolls: Boolean(getSetting("showRolls")),
      showChatFeed: Boolean(getSetting("showChatFeed")),
      showCombatBox: Boolean(getSetting("showCombatBox")),
      showMusicTracker: Boolean(getSetting("showMusicTracker")),
      showQuestBox: Boolean(getSetting("showQuestBox")),
      autoPanCombat: Boolean(getSetting("autoPanCombat")),
      autoCenterInterval: Number(getSetting("autoCenterInterval")) || 0,
      cinematicHandouts: Boolean(getSetting("cinematicHandouts")),
      autoLocationBanner: Boolean(getSetting("autoLocationBanner")),
      positions: this.#draftPositions,
      obsUrlDefault: `${baseUrl}?streamhud=1`,
      obsUrlMap: `${baseUrl}?streamhud=1&mode=tactical`,
      obsUrlRp: `${baseUrl}?streamhud=1&mode=roleplay`
    };
  }

  async _renderHTML(ctx) {
    const wrap = document.createElement("div");
    wrap.className = "ksh-config-wrap";

    const tabs = [
      { id: "party", label: t("Config.TabParty"), icon: "fa-users" },
      { id: "system", label: t("Config.TabSystem"), icon: "fa-sliders" },
      { id: "stage", label: t("Config.TabStage"), icon: "fa-up-down-left-right" },
      { id: "theme", label: t("Config.TabTheme"), icon: "fa-palette" },
      { id: "live", label: t("Config.TabLive"), icon: "fa-tower-broadcast" }
    ];

    const navHtml = tabs
      .map(
        (tab) => `
        <button type="button" class="ksh-tab-btn ${this.#activeTab === tab.id ? "is-active" : ""}" data-tab="${tab.id}">
          <i class="fa-solid ${tab.icon}"></i> ${escapeHtml(tab.label)}
        </button>
      `
      )
      .join("");

    wrap.innerHTML = `
      <nav class="ksh-tab-nav">${navHtml}</nav>
      <div class="ksh-tab-panels">
        ${this.#renderPartyTab(ctx)}
        ${this.#renderSystemTab(ctx)}
        ${this.#renderStageTab(ctx)}
        ${this.#renderThemeTab(ctx)}
        ${this.#renderLiveTab(ctx)}
      </div>
      <footer class="ksh-config-footer">
        <button type="button" class="ksh-btn-secondary" data-action="open-live">
          <i class="fa-solid fa-arrow-up-right-from-square"></i> ${escapeHtml(t("Config.OpenLiveTab"))}
        </button>
        <button type="submit" class="ksh-btn-primary">
          <i class="fa-solid fa-floppy-disk"></i> ${escapeHtml(t("Config.SaveButton"))}
        </button>
      </footer>
    `;

    return wrap;
  }

  #renderPartyTab(ctx) {
    const actorRows =
      ctx.partyActors.length > 0
        ? ctx.partyActors
            .map((actor) => {
              const idx = ctx.selectedIds.indexOf(actor.id);
              const checked = idx !== -1 ? "checked" : "";
              const order = idx !== -1 ? idx + 1 : "";
              const sc = ctx.slotConfigs?.[actor.id] || { mode: "transparent", url: "" };
              return `
                <div class="ksh-actor-card">
                  <label class="ksh-actor-row">
                    <input type="checkbox" name="actor_${escapeHtml(actor.id)}" value="${escapeHtml(actor.id)}" ${checked} />
                    <img src="${escapeHtml(sanitizeUrl(actor.img, { allowRelative: true }))}" alt="${escapeHtml(actor.name)}" />
                    <div class="ksh-actor-meta">
                      <strong>${escapeHtml(actor.name)}</strong>
                      <span>${escapeHtml(actor.type)}</span>
                    </div>
                    <input type="number" class="ksh-order-input" name="order_${escapeHtml(actor.id)}" value="${escapeHtml(order)}" min="1" max="6" placeholder="#" />
                  </label>
                  <div class="ksh-slot-sub">
                    <select name="slotMode_${escapeHtml(actor.id)}" class="ksh-slot-mode" data-actor-id="${escapeHtml(actor.id)}">
                      <option value="transparent" ${sc.mode === "transparent" ? "selected" : ""}>${escapeHtml(t("Config.SlotModeTransparent"))}</option>
                      <option value="portrait" ${sc.mode === "portrait" ? "selected" : ""}>${escapeHtml(t("Config.SlotModePortrait"))}</option>
                      <option value="iframe" ${sc.mode === "iframe" ? "selected" : ""}>${escapeHtml(t("Config.SlotModeIframe"))}</option>
                    </select>
                    <div class="ksh-slot-url-row" style="${sc.mode === "iframe" ? "" : "display:none;"}">
                      <input type="text" name="slotUrl_${escapeHtml(actor.id)}" value="${escapeHtml(sc.url || "")}" placeholder="${escapeHtml(t("Config.SlotUrlPlaceholder"))}" class="ksh-slot-url-input" />
                      <button type="button" class="ksh-vdo-gen-btn" data-actor-id="${escapeHtml(actor.id)}" title="${escapeHtml(t("Config.VdoGenTitle"))}">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> ${escapeHtml(t("Config.VdoGenBtn"))}
                      </button>
                    </div>
                  </div>
                </div>
              `;
            })
            .join("")
        : `<p class="ksh-empty-msg">${escapeHtml(t("Config.NoActors"))}</p>`;

    return `
      <section class="ksh-tab-panel ${this.#activeTab === "party" ? "is-active" : ""}" data-panel="party">
        <div class="ksh-field-row">
          <label>${escapeHtml(t("Config.VdoRoomLabel"))}</label>
          <input type="text" name="vdoRoomName" value="${escapeHtml(ctx.vdoRoomName)}" placeholder="${escapeHtml(t("Config.VdoRoomPlaceholder"))}" />
        </div>
        <h3 class="ksh-section-title">${escapeHtml(t("Config.PartyTitle"))}</h3>
        <div class="ksh-actor-grid">${actorRows}</div>
      </section>
    `;
  }

  #renderSystemTab(ctx) {
    const presetOptions = PRESET_IDS.map(
      (id) =>
        `<option value="${escapeHtml(id)}" ${ctx.systemPreset === id ? "selected" : ""}>${escapeHtml(t(`Presets.${id}`))}</option>`
    ).join("");

    return `
      <section class="ksh-tab-panel ${this.#activeTab === "system" ? "is-active" : ""}" data-panel="system">
        <div class="ksh-field-row">
          <label>${escapeHtml(t("Config.SystemPresetLabel"))}</label>
          <select name="systemPreset">${presetOptions}</select>
        </div>
        <div class="ksh-field-col">
          <label>${escapeHtml(t("Config.CustomMappingLabel"))}</label>
          <textarea name="customMappingJson" rows="7" placeholder="${escapeHtml(t("Config.CustomMappingPlaceholder"))}">${escapeHtml(ctx.customMappingJson)}</textarea>
          <div class="ksh-json-status" data-role="json-status"></div>
        </div>
        <div class="ksh-test-row">
          <button type="button" class="ksh-btn-secondary" data-action="test-actor">
            <i class="fa-solid fa-flask"></i> ${escapeHtml(t("Config.TestActorBtn"))}
          </button>
        </div>
        <div class="ksh-test-preview" data-role="test-preview"></div>
      </section>
    `;
  }

  #renderStageTab(ctx) {
    const blocks = [
      { key: "p1", label: t("Config.StagePlayerLabel", { index: 1 }), w: 222, h: 86 },
      { key: "p2", label: t("Config.StagePlayerLabel", { index: 2 }), w: 222, h: 86 },
      { key: "p3", label: t("Config.StagePlayerLabel", { index: 3 }), w: 222, h: 86 },
      { key: "p4", label: t("Config.StagePlayerLabel", { index: 4 }), w: 222, h: 86 },
      { key: "p5", label: t("Config.StagePlayerLabel", { index: 5 }), w: 222, h: 86 },
      { key: "p6", label: t("Config.StagePlayerLabel", { index: 6 }), w: 222, h: 86 },
      { key: "chat", label: t("Config.StageChatLabel"), w: 440, h: 240 },
      { key: "combat", label: t("Config.StageCombatLabel"), w: 440, h: 170 }
    ];

    const stageBlocksHtml = blocks
      .map((b) => {
        const pos = ctx.positions[b.key] || DEFAULT_POSITIONS[b.key];
        const leftPct = (pos.x / 1920) * 100;
        const topPct = (pos.y / 1080) * 100;
        const wPct = (b.w / 1920) * 100;
        const hPct = (b.h / 1080) * 100;
        return `
          <div class="ksh-stage-block" data-key="${b.key}" style="left:${leftPct}%; top:${topPct}%; width:${wPct}%; height:${hPct}%;">
            <span>${escapeHtml(b.label)}</span>
          </div>
        `;
      })
      .join("");

    return `
      <section class="ksh-tab-panel ${this.#activeTab === "stage" ? "is-active" : ""}" data-panel="stage">
        <div class="ksh-stage-toolbar">
          <span>${escapeHtml(t("Config.DragHint"))}</span>
          <button type="button" class="ksh-btn-secondary" data-action="reset-positions">
            <i class="fa-solid fa-rotate-left"></i> ${escapeHtml(t("Config.ResetPositions"))}
          </button>
        </div>
        <div class="ksh-stage-canvas" data-role="stage-canvas">
          ${stageBlocksHtml}
        </div>
      </section>
    `;
  }

  #renderThemeTab(ctx) {
    const themeOpts = THEMES.map(
      (id) =>
        `<option value="${escapeHtml(id)}" ${ctx.theme === id ? "selected" : ""}>${escapeHtml(t(`Themes.${id}`))}</option>`
    ).join("");

    const modeOpts = OVERLAY_MODES.map(
      (id) =>
        `<option value="${escapeHtml(id)}" ${ctx.overlayMode === id ? "selected" : ""}>${escapeHtml(t(OVERLAY_I18N_MAP[id]))}</option>`
    ).join("");

    const toggles = [
      ["hideFoundryUI", "Settings.HideFoundryUI"],
      ["showPrimaryBar", "Settings.ShowPrimaryBarName"],
      ["showSecondaryBar", "Settings.ShowSecondaryBarName"],
      ["showTertiaryBar", "Settings.ShowTertiaryBarName"],
      ["showDefense", "Settings.ShowDefenseName"],
      ["showConditions", "Settings.ShowConditionsName"],
      ["showRolls", "Settings.ShowRollsName"],
      ["showChatFeed", "Settings.ShowChatFeedName"],
      ["showCombatBox", "Settings.ShowCombatBoxName"],
      ["showMusicTracker", "Settings.ShowMusicTrackerName"],
      ["showQuestBox", "Settings.ShowQuestBoxName"],
      ["autoPanCombat", "Settings.AutoPanCombatName"],
      ["cinematicHandouts", "Settings.CinematicHandoutsName"],
      ["autoLocationBanner", "Settings.AutoLocationBannerName"]
    ]
      .map(
        ([name, labelKey]) => `
        <label class="ksh-toggle-item">
          <input type="checkbox" name="${name}" ${ctx[name] ? "checked" : ""} />
          <span>${escapeHtml(t(labelKey))}</span>
        </label>
      `
      )
      .join("");

    return `
      <section class="ksh-tab-panel ${this.#activeTab === "theme" ? "is-active" : ""}" data-panel="theme">
        <div class="ksh-two-col">
          <div class="ksh-field-col">
            <label>${escapeHtml(t("Config.ThemeLabel"))}</label>
            <select name="theme">${themeOpts}</select>
          </div>
          <div class="ksh-field-col">
            <label>${escapeHtml(t("Config.OverlayModeLabel"))}</label>
            <select name="overlayMode">${modeOpts}</select>
          </div>
        </div>
        <div class="ksh-field-col">
          <label>${escapeHtml(t("Config.CustomImgLabel"))}</label>
          <div class="ksh-input-group">
            <input type="text" name="customOverlayImg" value="${escapeHtml(ctx.customOverlayImg)}" placeholder="${escapeHtml(t("Config.CustomImgPlaceholder"))}" />
            <button type="button" class="ksh-btn-secondary" data-action="browse-img">
              <i class="fa-solid fa-folder-open"></i> ${escapeHtml(t("Config.BrowseImg"))}
            </button>
          </div>
        </div>
        <div class="ksh-two-col">
          <div class="ksh-field-col">
            <label>${escapeHtml(t("Config.CampaignTitleLabel"))}</label>
            <input type="text" name="campaignTitle" value="${escapeHtml(ctx.campaignTitle)}" />
          </div>
          <div class="ksh-field-col">
            <label>${escapeHtml(t("Config.CampaignSubtitleLabel"))}</label>
            <input type="text" name="campaignSubtitle" value="${escapeHtml(ctx.campaignSubtitle)}" />
          </div>
        </div>
        <div class="ksh-field-col">
          <label>${escapeHtml(t("Config.QuestTextLabel"))}</label>
          <input type="text" name="customQuestText" value="${escapeHtml(ctx.customQuestText)}" placeholder="${escapeHtml(t("Config.QuestTextPlaceholder"))}" />
        </div>
        <div class="ksh-field-row">
          <label>${escapeHtml(t("Settings.AutoCenterIntervalName"))}</label>
          <input type="number" name="autoCenterInterval" min="0" max="600" value="${escapeHtml(ctx.autoCenterInterval)}" />
        </div>
        <h3 class="ksh-section-title">${escapeHtml(t("Config.VisibilityTogglesTitle"))}</h3>
        <div class="ksh-toggle-grid">${toggles}</div>
      </section>
    `;
  }

  #renderLiveTab(ctx) {
    const bossOpts = [
      `<option value="">— ${escapeHtml(t("Config.NoBoss"))} —</option>`,
      ...ctx.bossActors.map(
        (a) =>
          `<option value="${escapeHtml(a.id)}" ${ctx.bossActorId === a.id ? "selected" : ""}>${escapeHtml(a.name)}</option>`
      )
    ].join("");

    const urls = [
      { label: t("Config.ObsUrlDefault"), val: ctx.obsUrlDefault },
      { label: t("Config.ObsUrlMap"), val: ctx.obsUrlMap },
      { label: t("Config.ObsUrlRp"), val: ctx.obsUrlRp }
    ]
      .map(
        (u) => `
        <div class="ksh-obs-row">
          <label>${escapeHtml(u.label)}</label>
          <div class="ksh-input-group">
            <input type="text" readonly value="${escapeHtml(u.val)}" />
            <button type="button" class="ksh-btn-secondary" data-copy-url="${escapeHtml(u.val)}">
              <i class="fa-solid fa-copy"></i> ${escapeHtml(t("Config.CopyObsUrl"))}
            </button>
          </div>
        </div>
      `
      )
      .join("");

    return `
      <section class="ksh-tab-panel ${this.#activeTab === "live" ? "is-active" : ""}" data-panel="live">
        <h3 class="ksh-section-title">${escapeHtml(t("Config.BossTitle"))}</h3>
        <div class="ksh-input-group">
          <select name="bossActorId">${bossOpts}</select>
          <button type="button" class="ksh-btn-secondary" data-action="clear-boss">${escapeHtml(t("Config.BossClearBtn"))}</button>
        </div>
        <h3 class="ksh-section-title">${escapeHtml(t("Config.TestControlsTitle"))}</h3>
        <div class="ksh-live-actions">
          <button type="button" class="ksh-btn-secondary" data-action="test-crit">${escapeHtml(t("Config.TestCrit"))}</button>
          <button type="button" class="ksh-btn-secondary" data-action="test-fumble">${escapeHtml(t("Config.TestFumble"))}</button>
          <button type="button" class="ksh-btn-secondary" data-action="test-location">${escapeHtml(t("Config.TestLocation"))}</button>
          <button type="button" class="ksh-btn-secondary" data-action="force-refresh">${escapeHtml(t("Config.TriggerRefresh"))}</button>
          <button type="button" class="ksh-btn-secondary" data-action="recenter-cam">${escapeHtml(t("Config.RecenterCamera"))}</button>
        </div>
        <h3 class="ksh-section-title">${escapeHtml(t("Config.ObsLinksLabel"))}</h3>
        <div class="ksh-obs-list">${urls}</div>
      </section>
    `;
  }

  _replaceHTML(result, content) {
    content.replaceChildren(result);
  }

  _onRender(_context, _options) {
    const root = this.element;
    if (!root) return;

    // Tab switching
    root.querySelectorAll(".ksh-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tabId = btn.dataset.tab;
        this.#activeTab = tabId;
        root.querySelectorAll(".ksh-tab-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === tabId));
        root.querySelectorAll(".ksh-tab-panel").forEach((p) => p.classList.toggle("is-active", p.dataset.panel === tabId));
      });
    });

    // Slot mode URL row toggle
    root.querySelectorAll(".ksh-slot-mode").forEach((sel) => {
      sel.addEventListener("change", () => {
        const row = sel.closest(".ksh-slot-sub")?.querySelector(".ksh-slot-url-row");
        if (row) row.style.display = sel.value === "iframe" ? "" : "none";
      });
    });

    // VDO.Ninja link generator
    root.querySelectorAll(".ksh-vdo-gen-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const room = root.querySelector('input[name="vdoRoomName"]')?.value?.trim();
        if (!room) {
          ui.notifications?.warn(t("Notifications.VdoRoomRequired"));
          return;
        }
        const actorId = btn.dataset.actorId;
        const actor = game.actors?.get?.(actorId);
        const orderVal = Number(root.querySelector(`input[name="order_${actorId}"]`)?.value) || 1;
        const links = buildVdoLinks(room, orderVal - 1, actor?.name || "");
        const urlInput = root.querySelector(`input[name="slotUrl_${actorId}"]`);
        if (urlInput) urlInput.value = links.viewUrl;
        await navigator.clipboard?.writeText?.(links.pushUrl);
        ui.notifications?.info(t("Notifications.VdoCopiedNotice", { name: actor?.name || "Player" }));
      });
    });

    // JSON validation indicator
    const jsonTextarea = root.querySelector('textarea[name="customMappingJson"]');
    const jsonStatus = root.querySelector('[data-role="json-status"]');
    const updateJsonStatus = () => {
      if (!jsonTextarea || !jsonStatus) return;
      const raw = jsonTextarea.value.trim();
      if (!raw) {
        jsonStatus.textContent = "";
        jsonStatus.className = "ksh-json-status";
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        if (!isPlainObject(parsed)) {
          throw new Error("Mapping JSON must be a plain object");
        }
        jsonStatus.textContent = t("Config.MappingValid");
        jsonStatus.className = "ksh-json-status is-valid";
      } catch {
        jsonStatus.textContent = t("Config.MappingInvalid");
        jsonStatus.className = "ksh-json-status is-invalid";
      }
    };
    jsonTextarea?.addEventListener("input", updateJsonStatus);
    updateJsonStatus();

    // Test mapping on selected actor
    root.querySelector('[data-action="test-actor"]')?.addEventListener("click", () => {
      const previewEl = root.querySelector('[data-role="test-preview"]');
      const tokenActor = canvas?.tokens?.controlled?.[0]?.actor;
      const fallbackId = (getSetting("partyActorIds") || [])[0];
      const actor = tokenActor || (fallbackId ? game.actors?.get?.(fallbackId) : null);
      if (!actor) {
        ui.notifications?.warn(t("Notifications.NoActorSelectedNotice"));
        if (previewEl) previewEl.innerHTML = `<p>${escapeHtml(t("Config.TestNoActor"))}</p>`;
        return;
      }

      let override = null;
      const preset = root.querySelector('select[name="systemPreset"]')?.value;
      const rawJson = jsonTextarea?.value?.trim();
      if (preset === "custom" && rawJson) {
        try {
          const parsed = JSON.parse(rawJson);
          if (!isPlainObject(parsed)) {
            ui.notifications?.error(t("Notifications.InvalidJsonNotice"));
            return;
          }
          override = parsed;
        } catch {
          ui.notifications?.error(t("Notifications.InvalidJsonNotice"));
          return;
        }
      }

      const res = testActorMapping(actor, override);
      const d = res.data;
      if (previewEl) {
        previewEl.innerHTML = `
          <div class="ksh-preview-box">
            <strong>${escapeHtml(t("Config.TestActorResult"))}: ${escapeHtml(d.name)}</strong>
            <div>${escapeHtml(d.primary.label)}: ${escapeHtml(d.primary.value)}/${escapeHtml(d.primary.max)}</div>
            ${d.secondary.hasData ? `<div>${escapeHtml(d.secondary.label)}: ${escapeHtml(d.secondary.value)}/${escapeHtml(d.secondary.max)}</div>` : ""}
            ${d.tertiary.hasData ? `<div>${escapeHtml(d.tertiary.label)}: ${escapeHtml(d.tertiary.value)}/${escapeHtml(d.tertiary.max)}</div>` : ""}
            <div>${escapeHtml(d.defense.label || t("HUD.DefenseLabel"))}: ${escapeHtml(d.defense.value ?? "—")}</div>
            ${res.warnings?.length ? `<div class="ksh-preview-warn">${res.warnings.map((w) => escapeHtml(w)).join("<br>")}</div>` : ""}
          </div>
        `;
      }
    });

    // Drag-and-drop stage
    const stage = root.querySelector('[data-role="stage-canvas"]');
    if (stage) {
      stage.querySelectorAll(".ksh-stage-block").forEach((block) => {
        block.addEventListener("pointerdown", (ev) => {
          ev.preventDefault();
          const key = block.dataset.key;
          const rect = stage.getBoundingClientRect();
          const startX = ev.clientX;
          const startY = ev.clientY;
          const initPos = this.#draftPositions[key] || DEFAULT_POSITIONS[key];

          const onMove = (moveEv) => {
            const dx = ((moveEv.clientX - startX) / rect.width) * 1920;
            const dy = ((moveEv.clientY - startY) / rect.height) * 1080;
            const nx = Math.max(0, Math.min(1800, Math.round(initPos.x + dx)));
            const ny = Math.max(0, Math.min(1040, Math.round(initPos.y + dy)));
            this.#draftPositions[key] = { x: nx, y: ny };
            block.style.left = `${(nx / 1920) * 100}%`;
            block.style.top = `${(ny / 1080) * 100}%`;
          };

          const onUp = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
          };
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
        });
      });
    }

    root.querySelector('[data-action="reset-positions"]')?.addEventListener("click", () => {
      this.#draftPositions = foundry.utils.deepClone(DEFAULT_POSITIONS);
      if (stage) {
        stage.querySelectorAll(".ksh-stage-block").forEach((block) => {
          const p = this.#draftPositions[block.dataset.key];
          if (p) {
            block.style.left = `${(p.x / 1920) * 100}%`;
            block.style.top = `${(p.y / 1080) * 100}%`;
          }
        });
      }
      ui.notifications?.info(t("Notifications.PositionsResetNotice"));
    });

    // FilePicker for custom overlay image
    root.querySelector('[data-action="browse-img"]')?.addEventListener("click", () => {
      const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
      const input = root.querySelector('input[name="customOverlayImg"]');
      new FP({
        type: "image",
        current: input?.value || "",
        callback: (path) => {
          if (input) input.value = path;
        }
      }).render(true);
    });

    // Live controls
    root.querySelector('[data-action="clear-boss"]')?.addEventListener("click", async () => {
      const sel = root.querySelector('select[name="bossActorId"]');
      if (sel) sel.value = "";
      await setSetting("bossActorId", "");
      emitHudEvent("refresh", {}, { local: true });
      ui.notifications?.info(t("Notifications.BossClearedNotice"));
    });

    root.querySelector('[data-action="test-crit"]')?.addEventListener("click", () => {
      emitHudEvent("epic-banner", { type: "crit", actorName: "Tester", total: 20 }, { local: true });
    });

    root.querySelector('[data-action="test-fumble"]')?.addEventListener("click", () => {
      emitHudEvent("epic-banner", { type: "fumble", actorName: "Tester", total: 1 }, { local: true });
    });

    root.querySelector('[data-action="test-location"]')?.addEventListener("click", () => {
      emitHudEvent(
        "location-banner",
        { title: game.scenes?.active?.name || "Stream Scene", subtitle: getSetting("campaignSubtitle") || "" },
        { local: true }
      );
    });

    root.querySelector('[data-action="force-refresh"]')?.addEventListener("click", () => {
      emitHudEvent("refresh", {}, { local: true });
    });

    root.querySelector('[data-action="recenter-cam"]')?.addEventListener("click", () => {
      KorujaStreamHUD.recenterCamera();
    });

    root.querySelectorAll("[data-copy-url]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await navigator.clipboard?.writeText?.(btn.dataset.copyUrl || "");
        ui.notifications?.info(t("Notifications.ObsCopiedNotice"));
      });
    });

    root.querySelector('[data-action="open-live"]')?.addEventListener("click", () => {
      const base = window.location.href.split("?")[0];
      window.open(`${base}?streamhud=1`, "_blank", "noopener");
    });
  }

  static async #onSubmit(_event, form, formData) {
    const data = formData.object;

    // Validate custom JSON if custom preset selected
    const customJson = String(data.customMappingJson || "").trim();
    if (data.systemPreset === "custom" && customJson) {
      try {
        const parsed = JSON.parse(customJson);
        if (!isPlainObject(parsed)) {
          ui.notifications?.error(t("Notifications.InvalidJsonNotice"));
          return;
        }
      } catch {
        ui.notifications?.error(t("Notifications.InvalidJsonNotice"));
        return;
      }
    }

    // Collect ordered party actors (up to 6) and slot configs
    const selected = [];
    const slotConfigs = {};
    for (const actor of game.actors?.contents || []) {
      const id = actor.id;
      if (data[`actor_${id}`]) {
        const order = Number(data[`order_${id}`]) || 99;
        selected.push({ id, order });
      }
      const mode = data[`slotMode_${id}`];
      const url = sanitizeUrl(String(data[`slotUrl_${id}`] || "").trim(), {
        allowRelative: false
      });
      if (mode) {
        slotConfigs[id] = { mode, url };
      }
    }
    selected.sort((a, b) => a.order - b.order);
    const partyActorIds = selected.slice(0, 6).map((s) => s.id);

    await Promise.all([
      setSetting("partyActorIds", partyActorIds),
      setSetting("playerSlotConfigs", slotConfigs),
      setSetting("vdoRoomName", String(data.vdoRoomName || "").trim()),
      setSetting("systemPreset", data.systemPreset || "auto"),
      setSetting("customMappingJson", customJson),
      setSetting("theme", data.theme || "fantasy"),
      setSetting("overlayMode", data.overlayMode || "builtin-tactical"),
      setSetting(
        "customOverlayImg",
        sanitizeUrl(String(data.customOverlayImg || "").trim(), {
          allowRelative: true
        })
      ),
      setSetting("campaignTitle", String(data.campaignTitle || "").trim()),
      setSetting("campaignSubtitle", String(data.campaignSubtitle || "").trim()),
      setSetting("customQuestText", String(data.customQuestText || "").trim()),
      setSetting("bossActorId", String(data.bossActorId || "").trim()),
      setSetting("autoCenterInterval", Math.max(0, Number(data.autoCenterInterval) || 0)),
      setSetting("hideFoundryUI", Boolean(data.hideFoundryUI)),
      setSetting("showPrimaryBar", Boolean(data.showPrimaryBar)),
      setSetting("showSecondaryBar", Boolean(data.showSecondaryBar)),
      setSetting("showTertiaryBar", Boolean(data.showTertiaryBar)),
      setSetting("showDefense", Boolean(data.showDefense)),
      setSetting("showConditions", Boolean(data.showConditions)),
      setSetting("showRolls", Boolean(data.showRolls)),
      setSetting("showChatFeed", Boolean(data.showChatFeed)),
      setSetting("showCombatBox", Boolean(data.showCombatBox)),
      setSetting("showMusicTracker", Boolean(data.showMusicTracker)),
      setSetting("showQuestBox", Boolean(data.showQuestBox)),
      setSetting("autoPanCombat", Boolean(data.autoPanCombat)),
      setSetting("cinematicHandouts", Boolean(data.cinematicHandouts)),
      setSetting("autoLocationBanner", Boolean(data.autoLocationBanner)),
      setSetting("cardPositions", this.#draftPositions || DEFAULT_POSITIONS)
    ]);

    emitHudEvent("refresh", {}, { local: true });
    ui.notifications?.info(t("Notifications.SavedNotice"));
  }
}
