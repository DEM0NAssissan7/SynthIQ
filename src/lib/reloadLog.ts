/**
 * Every page reload the app performs goes through here, with a reason, and
 * every page load is recorded too. The Debug page shows the log, so a reload
 * (which shows as the whole screen blanking for a moment) can be traced to
 * whatever asked for it — or shown to have come from the browser itself.
 */

const LOG_KEY = "synthiq.reloadLog";
const MAX_ENTRIES = 40;

export interface ReloadLogEntry {
  time: number;
  event: string;
}

function append(event: string) {
  try {
    const log = getReloadLog();
    log.push({ time: Date.now(), event });
    localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(-MAX_ENTRIES)));
  } catch {
    // Storage unavailable
  }
}

export function getReloadLog(): ReloadLogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearReloadLog() {
  try {
    localStorage.removeItem(LOG_KEY);
  } catch {
    // Storage unavailable
  }
}

/** Reload the page now, recording why. */
export function reloadApp(reason: string) {
  append(`reload requested: ${reason}`);
  window.location.reload();
}

let pendingReason: string | null = null;
let hiddenListenerAdded = false;

/**
 * Reload for something that isn't urgent (a new app version): right away if
 * the app is in the background, otherwise the next time it goes there, so
 * the user never watches the screen blank and rebuild.
 */
export function reloadWhenHidden(reason: string) {
  if (document.hidden) {
    reloadApp(reason);
    return;
  }
  if (pendingReason === null) append(`reload deferred until hidden: ${reason}`);
  pendingReason = reason;
  if (hiddenListenerAdded) return;
  hiddenListenerAdded = true;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && pendingReason !== null) {
      const r = pendingReason;
      pendingReason = null;
      reloadApp(r);
    }
  });
}

/** Call once at startup. */
export function recordPageLoad() {
  let type = "unknown";
  try {
    const nav = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    if (nav) type = nav.type;
  } catch {
    // Not supported
  }
  append(`page loaded (${type}, ${document.visibilityState})`);
  document.addEventListener("visibilitychange", () => {
    append(document.hidden ? "went to background" : "came to foreground");
  });
  // bfcache restores don't run startup code again.
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) append("page restored from back/forward cache");
  });
}
