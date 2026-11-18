/**
 * System-agnostic RPG adapter for Koruja Stream HUD Universal.
 * Maps arbitrary Foundry VTT system data schemas into normalized HUD structures.
 */

import { MODULE_ID } from "./constants.js";

const FORBIDDEN_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Built-in system mapping presets.
 * Empty actor type arrays allow any actor type.
 */
export const SYSTEM_PRESETS = Object.freeze({
  dnd5e: {
    id: "dnd5e",
    label: "D&D 5e",
    partyActorTypes: ["character"],
    bossActorTypes: ["npc"],
    primaryBar: {
      valuePath: "system.attributes.hp.value",
      maxPath: "system.attributes.hp.max",
      tempPath: "system.attributes.hp.temp",
      label: "HP"
    },
    secondaryBar: null,
    tertiaryBar: null,
    defense: { path: "system.attributes.ac.value", label: "AC" },
    level: { path: "system.details.level", label: "LVL" },
    inspirationPath: "system.attributes.inspiration",
    deathSavePaths: {
      successPath: "system.attributes.death.success",
      failurePath: "system.attributes.death.failure",
      maxSuccess: 3,
      maxFailure: 3
    },
    concentrationStatusId: "concentrating",
    rollMode: "d20"
  },

  pf2e: {
    id: "pf2e",
    label: "Pathfinder 2e",
    partyActorTypes: ["character"],
    bossActorTypes: ["npc", "hazard"],
    primaryBar: {
      valuePath: "system.attributes.hp.value",
      maxPath: "system.attributes.hp.max",
      tempPath: "system.attributes.hp.temp",
      label: "HP"
    },
    secondaryBar: null,
    tertiaryBar: null,
    defense: { path: "system.attributes.ac.value", label: "AC" },
    level: { path: "system.details.level.value", label: "LVL" },
    inspirationPath: "system.resources.heroPoints.value",
    deathSavePaths: null,
    concentrationStatusId: null,
    rollMode: "d20"
  },

  deltagreen: {
    id: "deltagreen",
    label: "Delta Green",
    partyActorTypes: ["agent"],
    bossActorTypes: ["npc", "unnatural"],
    primaryBar: {
      valuePath: "system.health.value",
      maxPath: "system.health.max",
      tempPath: "",
      label: "HP"
    },
    secondaryBar: {
      valuePath: "system.sanity.value",
      maxPath: "system.sanity.max",
      thresholdPath: "system.sanity.currentBreakingPoint",
      label: "SAN"
    },
    tertiaryBar: {
      valuePath: "system.wp.value",
      maxPath: "system.wp.max",
      label: "WP"
    },
    defense: { path: "", label: "" },
    level: { path: "system.biography.profession", label: "" },
    inspirationPath: null,
    deathSavePaths: null,
    concentrationStatusId: null,
    rollMode: "d100"
  },

  coc7: {
    id: "coc7",
    label: "Call of Cthulhu 7e",
    partyActorTypes: ["character"],
    bossActorTypes: ["npc", "creature"],
    primaryBar: {
      valuePath: "system.attribs.hp.value",
      maxPath: "system.attribs.hp.max",
      tempPath: "",
      label: "HP"
    },
    secondaryBar: {
      valuePath: "system.attribs.san.value",
      maxPath: "system.attribs.san.max",
      thresholdPath: "",
      label: "SAN"
    },
    tertiaryBar: {
      valuePath: "system.attribs.mp.value",
      maxPath: "system.attribs.mp.max",
      label: "MP"
    },
    defense: { path: "system.attribs.armor.value", label: "ARM" },
    level: { path: "system.infos.occupation", label: "" },
    inspirationPath: "system.attribs.lck.value",
    deathSavePaths: null,
    concentrationStatusId: null,
    rollMode: "d100"
  },

  tormenta20: {
    id: "tormenta20",
    label: "Tormenta20",
    partyActorTypes: ["character"],
    bossActorTypes: ["npc"],
    primaryBar: {
      valuePath: "system.attributes.pv.value",
      maxPath: "system.attributes.pv.max",
      tempPath: "system.attributes.pv.temp",
      label: "PV"
    },
    secondaryBar: {
      valuePath: "system.attributes.pm.value",
      maxPath: "system.attributes.pm.max",
      thresholdPath: "",
      label: "PM"
    },
    tertiaryBar: null,
    defense: { path: "system.attributes.defesa.value", label: "DEF" },
    level: { path: "system.attributes.nivel.value", label: "NV" },
    inspirationPath: null,
    deathSavePaths: null,
    concentrationStatusId: null,
    rollMode: "d20"
  },

  swade: {
    id: "swade",
    label: "Savage Worlds (SWADE)",
    partyActorTypes: ["character"],
    bossActorTypes: ["npc"],
    primaryBar: {
      valuePath: "system.wounds.value",
      maxPath: "system.wounds.max",
      tempPath: "",
      label: "WND"
    },
    secondaryBar: {
      valuePath: "system.fatigue.value",
      maxPath: "system.fatigue.max",
      thresholdPath: "",
      label: "FAT"
    },
    tertiaryBar: {
      valuePath: "system.powerPoints.general.value",
      maxPath: "system.powerPoints.general.max",
      label: "PP"
    },
    defense: { path: "system.stats.parry.value", label: "PAR" },
    level: { path: "system.advances.rank", label: "" },
    inspirationPath: "system.bennies.value",
    deathSavePaths: null,
    concentrationStatusId: null,
    rollMode: "generic"
  },

  generic: {
    id: "generic",
    label: "Generic / Universal",
    partyActorTypes: [],
    bossActorTypes: [],
    primaryBar: {
      valuePath: "system.attributes.hp.value",
      maxPath: "system.attributes.hp.max",
      tempPath: "system.attributes.hp.temp",
      label: "HP"
    },
    secondaryBar: {
      valuePath: "system.resources.secondary.value",
      maxPath: "system.resources.secondary.max",
      thresholdPath: "",
      label: ""
    },
    tertiaryBar: null,
    defense: { path: "system.attributes.ac.value", label: "DEF" },
    level: { path: "system.details.level", label: "LVL" },
    inspirationPath: null,
    deathSavePaths: null,
    concentrationStatusId: null,
    rollMode: "generic"
  }
});

export const PRESET_IDS = Object.freeze([
  "auto",
  "dnd5e",
  "pf2e",
  "deltagreen",
  "coc7",
  "tormenta20",
  "swade",
  "generic",
  "custom"
]);

const SYSTEM_ID_ALIASES = Object.freeze({
  dnd5e: "dnd5e",
  pf2e: "pf2e",
  deltagreen: "deltagreen",
  "delta-green": "deltagreen",
  coc7: "coc7",
  tormenta20: "tormenta20",
  swade: "swade"
});

/**
 * Safely reads a nested property using dot notation (e.g. "system.attributes.hp.value").
 * @param {object} obj
 * @param {string} path
 * @returns {unknown}
 */
export function getByPath(obj, path) {
  if (!obj || typeof obj !== "object" || typeof path !== "string") return undefined;
  const trimmed = path.trim();
  if (!trimmed) return undefined;

  let current = obj;
  const segments = trimmed.split(".");
  for (const segment of segments) {
    if (!segment || FORBIDDEN_SEGMENTS.has(segment)) return undefined;
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function toFiniteNumber(val) {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string" && val.trim() !== "") {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function clonePreset(preset) {
  return JSON.parse(JSON.stringify(preset));
}

function mergeMappings(base, override) {
  if (!override || typeof override !== "object") return clonePreset(base);
  const merged = clonePreset(base);
  for (const [key, val] of Object.entries(override)) {
    if (FORBIDDEN_SEGMENTS.has(key)) continue;
    if (val && typeof val === "object" && !Array.isArray(val) && merged[key] && typeof merged[key] === "object") {
      merged[key] = { ...merged[key], ...val };
    } else if (val !== undefined) {
      merged[key] = val;
    }
  }
  return merged;
}

/**
 * Resolves the active system mapping from world settings and current Foundry system.
 * @returns {object}
 */
export function getActiveMapping() {
  let presetKey = "auto";
  let customJson = "";

  try {
    presetKey = game.settings.get(MODULE_ID, "systemPreset") || "auto";
    customJson = game.settings.get(MODULE_ID, "customMappingJson") || "";
  } catch {
    // Settings may not be registered yet during early init.
  }

  if (presetKey === "auto") {
    const sysId = String(game.system?.id || "").toLowerCase();
    const resolved = SYSTEM_ID_ALIASES[sysId] || (SYSTEM_PRESETS[sysId] ? sysId : "generic");
    return clonePreset(SYSTEM_PRESETS[resolved] || SYSTEM_PRESETS.generic);
  }

  if (presetKey === "custom") {
    if (customJson.trim()) {
      try {
        const parsed = JSON.parse(customJson);
        return mergeMappings(SYSTEM_PRESETS.generic, parsed);
      } catch (err) {
        console.warn(`[${MODULE_ID}] Invalid customMappingJson; falling back to generic:`, err);
      }
    }
    return clonePreset(SYSTEM_PRESETS.generic);
  }

  return clonePreset(SYSTEM_PRESETS[presetKey] || SYSTEM_PRESETS.generic);
}

function extractBar(actor, barConfig) {
  if (!barConfig || (!barConfig.valuePath && !barConfig.maxPath)) {
    return { value: 0, max: 0, temp: 0, threshold: null, pct: 0, label: "", hasData: false, belowThreshold: false };
  }

  const rawVal = toFiniteNumber(getByPath(actor, barConfig.valuePath));
  const rawMax = toFiniteNumber(getByPath(actor, barConfig.maxPath));
  const rawTemp = barConfig.tempPath ? toFiniteNumber(getByPath(actor, barConfig.tempPath)) ?? 0 : 0;
  const rawThreshold = barConfig.thresholdPath ? toFiniteNumber(getByPath(actor, barConfig.thresholdPath)) : null;

  const hasData = rawVal !== null || rawMax !== null;
  const value = rawVal ?? 0;
  const max = rawMax ?? Math.max(value, 0);
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  const belowThreshold = rawThreshold !== null && value <= rawThreshold;

  return {
    value,
    max,
    temp: Math.max(0, rawTemp),
    threshold: rawThreshold,
    pct,
    label: barConfig.label || "",
    hasData,
    belowThreshold
  };
}

function extractConditions(actor, concentrationStatusId) {
  const conditions = [];
  let concentrating = false;

  const effects = actor?.effects ? Array.from(actor.effects) : [];
  for (const effect of effects) {
    if (effect.disabled || effect.isSuppressed) continue;
    const statuses = effect.statuses ? Array.from(effect.statuses) : [];
    if (concentrationStatusId && statuses.includes(concentrationStatusId)) {
      concentrating = true;
      continue;
    }
    const name = effect.name || effect.label || "";
    const img = effect.img || effect.icon || "";
    if (name || img) {
      conditions.push({
        id: effect.id || statuses[0] || name,
        name,
        img
      });
    }
  }

  if (!concentrating && concentrationStatusId && actor?.statuses?.has?.(concentrationStatusId)) {
    concentrating = true;
  }

  return { concentrating, conditions };
}

/**
 * Normalizes a Foundry Actor into a system-agnostic HUD data object.
 * @param {Actor} actor
 * @param {object|null} [mappingOverride=null]
 * @returns {object|null}
 */
export function extractActorData(actor, mappingOverride = null) {
  if (!actor) return null;
  const mapping = mappingOverride || getActiveMapping();

  const primary = extractBar(actor, mapping.primaryBar);
  const secondary = extractBar(actor, mapping.secondaryBar);
  const tertiary = extractBar(actor, mapping.tertiaryBar);

  const defRaw = mapping.defense?.path ? getByPath(actor, mapping.defense.path) : undefined;
  const defense =
    defRaw !== undefined && defRaw !== null && defRaw !== ""
      ? { value: defRaw, label: mapping.defense?.label || "DEF" }
      : null;

  const lvlRaw = mapping.level?.path ? getByPath(actor, mapping.level.path) : undefined;
  const level =
    lvlRaw !== undefined && lvlRaw !== null && lvlRaw !== ""
      ? { value: lvlRaw, label: mapping.level?.label || "" }
      : null;

  const inspRaw = mapping.inspirationPath ? getByPath(actor, mapping.inspirationPath) : undefined;
  const inspNum = toFiniteNumber(inspRaw);
  const inspiration = inspNum !== null ? inspNum > 0 : Boolean(inspRaw);
  const inspirationCount = inspNum !== null ? inspNum : inspiration ? 1 : 0;

  let deathSaves = null;
  if (mapping.deathSavePaths && primary.hasData && primary.max > 0 && primary.value <= 0) {
    const successes = toFiniteNumber(getByPath(actor, mapping.deathSavePaths.successPath)) ?? 0;
    const failures = toFiniteNumber(getByPath(actor, mapping.deathSavePaths.failurePath)) ?? 0;
    deathSaves = {
      active: true,
      successes,
      failures,
      maxSuccess: mapping.deathSavePaths.maxSuccess ?? 3,
      maxFailure: mapping.deathSavePaths.maxFailure ?? 3
    };
  }

  const { concentrating, conditions } = extractConditions(actor, mapping.concentrationStatusId);

  const isDead = primary.hasData && primary.max > 0 && primary.value <= 0;
  const isBloodied = primary.hasData && primary.max > 0 && primary.value > 0 && primary.pct <= 50;
  const isCritical = primary.hasData && primary.max > 0 && primary.value > 0 && primary.pct <= 25;

  return {
    id: actor.id,
    uuid: actor.uuid,
    name: actor.name || "Unknown",
    img: actor.img || "icons/svg/mystery-man.svg",
    type: actor.type || "",
    primary,
    secondary,
    tertiary,
    defense,
    level,
    inspiration,
    inspirationCount,
    deathSaves,
    concentrating,
    conditions,
    isBloodied,
    isCritical,
    isDead
  };
}

/**
 * Extracts normalized boss/threat data from an Actor or TokenDocument.
 * @param {Actor|TokenDocument} actorOrToken
 * @param {object|null} [mappingOverride=null]
 * @returns {object|null}
 */
export function extractBossData(actorOrToken, mappingOverride = null) {
  if (!actorOrToken) return null;
  const actor = actorOrToken.actor || actorOrToken;
  const data = extractActorData(actor, mappingOverride);
  if (!data) return null;

  return {
    id: actorOrToken.id || data.id,
    uuid: actorOrToken.uuid || data.uuid,
    name: actorOrToken.name || data.name,
    img: actorOrToken.texture?.src || data.img,
    hp: data.primary,
    defense: data.defense,
    isDead: data.isDead
  };
}

/**
 * Tests a mapping configuration against an Actor and returns extracted data + diagnostics.
 * @param {Actor} actor
 * @param {object|null} [mappingOverride=null]
 * @returns {{ ok: boolean, mapping: object, data: object|null, warnings: string[] }}
 */
export function testActorMapping(actor, mappingOverride = null) {
  const mapping = mappingOverride || getActiveMapping();
  const warnings = [];

  if (!actor) {
    return { ok: false, mapping, data: null, warnings: ["No actor provided"] };
  }

  const data = extractActorData(actor, mapping);
  if (!data?.primary?.hasData) {
    warnings.push(`Primary bar paths did not resolve (${mapping.primaryBar?.valuePath || "unset"})`);
  }
  if (mapping.secondaryBar?.valuePath && !data?.secondary?.hasData) {
    warnings.push(`Secondary bar path did not resolve (${mapping.secondaryBar.valuePath})`);
  }
  if (mapping.tertiaryBar?.valuePath && !data?.tertiary?.hasData) {
    warnings.push(`Tertiary bar path did not resolve (${mapping.tertiaryBar.valuePath})`);
  }
  if (mapping.defense?.path && !data?.defense) {
    warnings.push(`Defense path did not resolve (${mapping.defense.path})`);
  }

  return {
    ok: Boolean(data?.primary?.hasData),
    mapping,
    data,
    warnings
  };
}

function stripHtml(html) {
  return String(html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function findDiceResults(roll, faces) {
  if (!roll?.dice) return [];
  const results = [];
  for (const die of roll.dice) {
    if (die.faces !== faces) continue;
    const active = (die.results || []).filter((r) => r.active !== false);
    for (const r of active) {
      results.push({ result: r.result, die });
    }
  }
  return results;
}

/**
 * Analyzes a Foundry ChatMessage roll in a system-agnostic way.
 * @param {ChatMessage} message
 * @param {object|null} [mappingOverride=null]
 * @returns {object|null}
 */
export function analyzeChatRoll(message, mappingOverride = null) {
  if (!message) return null;
  const rolls = message.rolls || [];
  if (!rolls.length) return null;

  const mapping = mappingOverride || getActiveMapping();
  const rollMode = mapping.rollMode || "generic";
  const roll = rolls[0];
  const total = toFiniteNumber(roll.total);
  const formula = roll.formula || "";
  const actorId = message.speaker?.actor || null;
  const actor = actorId ? game.actors?.get(actorId) : null;
  const actorName = message.speaker?.alias || actor?.name || message.author?.name || "";
  const flavor = stripHtml(message.flavor || "");

  let outcome = "neutral";

  if (rollMode === "d20") {
    const pf2eOutcome = message.flags?.pf2e?.context?.outcome;
    if (pf2eOutcome === "criticalSuccess") outcome = "crit";
    else if (pf2eOutcome === "criticalFailure") outcome = "fumble";
    else {
      const d20s = findDiceResults(roll, 20);
      if (d20s.length > 0) {
        const { result, die } = d20s[0];
        const critThreshold = die.options?.critical ?? 20;
        const fumbleThreshold = die.options?.fumble ?? 1;
        if (result >= critThreshold) outcome = "crit";
        else if (result <= fumbleThreshold) outcome = "fumble";
      }
    }
  } else if (rollMode === "d100") {
    const dgFlags = message.flags?.deltagreen || message.flags?.["delta-green"];
    const target = toFiniteNumber(dgFlags?.target ?? dgFlags?.chance ?? dgFlags?.skillValue);
    const d100Val = total;
    if (d100Val !== null) {
      if (d100Val === 1) {
        outcome = "crit";
      } else if (d100Val === 100) {
        outcome = "fumble";
      } else if (target !== null) {
        const isDouble = d100Val % 11 === 0 && d100Val > 0 && d100Val < 100;
        if (d100Val <= target) {
          outcome = isDouble ? "crit" : "success";
        } else {
          outcome = isDouble ? "fumble" : "failure";
        }
      }
    }
  } else {
    const d20s = findDiceResults(roll, 20);
    if (d20s.length > 0) {
      if (d20s[0].result >= 20) outcome = "crit";
      else if (d20s[0].result <= 1) outcome = "fumble";
    } else {
      const d100s = findDiceResults(roll, 100);
      if (d100s.length > 0) {
        if (d100s[0].result === 1) outcome = "crit";
        else if (d100s[0].result === 100) outcome = "fumble";
      }
    }
  }

  return {
    isRoll: true,
    rollMode,
    actorId,
    actorName,
    flavor,
    formula,
    total,
    outcome,
    isCrit: outcome === "crit",
    isFumble: outcome === "fumble",
    bannerType: outcome === "crit" ? "crit" : outcome === "fumble" ? "fumble" : null
  };
}
