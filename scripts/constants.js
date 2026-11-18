/**
 * Core constants and pure utility helpers for Koruja Stream HUD Universal.
 */

export const MODULE_ID = "koruja-stream-hud-universal";
export const SOCKET_NAME = "module.koruja-stream-hud-universal";
export const BROADCAST_CHANNEL = "koruja-stream-hud-universal";
export const I18N_PREFIX = "KORUJA_HUD";

export const THEMES = Object.freeze(["fantasy", "tactical", "minimal"]);

export const OVERLAY_MODES = Object.freeze([
  "builtin-tactical",
  "builtin-roleplay",
  "custom-image",
  "none"
]);

export const DEFAULT_POSITIONS = Object.freeze({
  p1: { x: 20, y: 976 },
  p2: { x: 258, y: 976 },
  p3: { x: 496, y: 976 },
  p4: { x: 734, y: 976 },
  p5: { x: 972, y: 976 },
  p6: { x: 1210, y: 976 },
  chat: { x: 1460, y: 334 },
  combat: { x: 1460, y: 874 }
});

export const ROLEPLAY_POSITIONS = Object.freeze({
  p1: { x: 36, y: 334 },
  p2: { x: 498, y: 334 },
  p3: { x: 960, y: 334 },
  p4: { x: 36, y: 690 },
  p5: { x: 498, y: 690 },
  p6: { x: 960, y: 690 },
  chat: { x: 1430, y: 372 },
  combat: { x: 1430, y: 874 }
});

/**
 * Escapes HTML special characters to prevent XSS in template strings.
 * @param {unknown} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Normalizes an arbitrary string into a URL-safe slug.
 * @param {string} name
 * @param {string} [fallback="player"]
 * @returns {string}
 */
export function slugifyName(name, fallback = "player") {
  return (
    String(name || fallback)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || fallback
  );
}
