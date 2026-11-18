/**
 * Cross-device game.socket + same-origin BroadcastChannel bridge
 * for Koruja Stream HUD Universal.
 */

import { BROADCAST_CHANNEL, MODULE_ID, SOCKET_NAME } from "./constants.js";

export const SOCKET_EVENTS = Object.freeze([
  "epic-banner",
  "location-banner",
  "spotlight",
  "refresh",
  "state-override"
]);

let channel = null;
let socketRegistered = false;
let activeHandlers = {};

function dispatchEvent(message) {
  if (!message || typeof message !== "object") return;
  const { type, payload } = message;
  if (!SOCKET_EVENTS.includes(type)) return;

  if (typeof activeHandlers.onEvent === "function") {
    activeHandlers.onEvent(type, payload, message);
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
    fn(payload, message);
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
    game.socket.on(SOCKET_NAME, (message) => {
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
