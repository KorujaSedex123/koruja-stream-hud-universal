/**
 * Cross-device game.socket + same-origin BroadcastChannel bridge
 * for Koruja Stream HUD Universal.
 */

import { BROADCAST_CHANNEL, clampNumber, MODULE_ID, sanitizeUrl, SOCKET_NAME } from "./constants.js";

export const SOCKET_EVENTS = Object.freeze([
  "epic-banner",
  "location-banner",
  "spotlight",
  "refresh",
  "state-override"
]);

const MAX_STRING_LEN = 300;
const URL_FIELDS = new Set(["img", "actorImg", "url"]);
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

let channel = null;
let socketRegistered = false;
let activeHandlers = {};

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function sanitizePayload(payload) {
  const clean = {};
  for (const [key, val] of Object.entries(payload)) {
    if (FORBIDDEN_KEYS.has(key) || val === undefined) continue;
    if (URL_FIELDS.has(key)) {
      clean[key] = sanitizeUrl(val, { allowRelative: true });
    } else if (key === "durationMs") {
      clean.durationMs = clampNumber(val, 1000, 60000, 4000);
    } else if (typeof val === "string") {
      clean[key] = val.slice(0, MAX_STRING_LEN);
    } else if (typeof val === "number") {
      if (Number.isFinite(val)) clean[key] = val;
    } else if (typeof val === "boolean" || val === null) {
      clean[key] = val;
    }
  }
  return clean;
}

function dispatchEvent(message) {
  if (!isPlainObject(message)) return;
  const { type, payload } = message;
  if (!SOCKET_EVENTS.includes(type)) return;
  if (!isPlainObject(payload)) return;

  const safePayload = sanitizePayload(payload);
  const safeMessage = { ...message, payload: safePayload };

  if (typeof activeHandlers.onEvent === "function") {
    activeHandlers.onEvent(type, safePayload, safeMessage);
  }

  const handlerMap = {
    "epic-banner": activeHandlers.onEpicBanner,
    "location-banner": activeHandlers.onLocationBanner,
    spotlight: activeHandlers.onSpotlight,
    refresh: activeHandlers.onRefresh,
    "state-override": activeHandlers.onStateOverride
  };

  const fn = handlerMap[type];
  if (typeof fn === "function") {
    fn(safePayload, safeMessage);
  }
}

/**
 * Initializes both game.socket and BroadcastChannel listeners.
 * Safe to call multiple times; updates active handlers.
 * @param {object} [handlers={}]
 * @param {Function} [handlers.onEpicBanner]
 * @param {Function} [handlers.onLocationBanner]
 * @param {Function} [handlers.onSpotlight]
 * @param {Function} [handlers.onRefresh]
 * @param {Function} [handlers.onStateOverride]
 * @param {Function} [handlers.onEvent]
 */
export function initSocketBridge(handlers = {}) {
  activeHandlers = handlers || {};

  if (!socketRegistered && game?.socket) {
    game.socket.on(SOCKET_NAME, (message, userId) => {
      if (!game.users?.get(userId)?.isGM) return;
      dispatchEvent(message);
    });
    socketRegistered = true;
  }

  if (!channel && typeof BroadcastChannel !== "undefined") {
    try {
      channel = new BroadcastChannel(BROADCAST_CHANNEL);
      channel.onmessage = (event) => {
        dispatchEvent(event?.data);
      };
    } catch (err) {
      console.warn(`[${MODULE_ID}] BroadcastChannel unavailable:`, err);
    }
  }
}

/**
 * Broadcasts a HUD event across Foundry clients (game.socket) and same-origin tabs (BroadcastChannel).
 * @param {"epic-banner"|"location-banner"|"spotlight"|"refresh"|"state-override"} type
 * @param {object} [payload={}]
 * @param {{ local?: boolean }} [options={}]
 */
export function emitHudEvent(type, payload = {}, options = {}) {
  if (!SOCKET_EVENTS.includes(type)) {
    console.warn(`[${MODULE_ID}] Unknown socket event type: ${type}`);
    return;
  }

  const message = {
    type,
    payload,
    senderId: game?.user?.id || null,
    timestamp: Date.now()
  };

  if (game?.socket) {
    try {
      game.socket.emit(SOCKET_NAME, message);
    } catch (err) {
      console.warn(`[${MODULE_ID}] game.socket.emit failed:`, err);
    }
  }

  if (channel) {
    try {
      channel.postMessage(message);
    } catch (err) {
      console.warn(`[${MODULE_ID}] BroadcastChannel.postMessage failed:`, err);
    }
  }

  if (options.local) {
    dispatchEvent(message);
  }
}

/**
 * Closes the BroadcastChannel if open.
 */
export function closeSocketBridge() {
  if (channel) {
    channel.close();
    channel = null;
  }
}
