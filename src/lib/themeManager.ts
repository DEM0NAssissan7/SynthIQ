import { PreferencesStore } from "../storage/preferencesStore";
import { initDynamicTheme } from "./dynamicTheme";

export type ThemeMode = "auto" | "dark" | "light";

export function getEffectiveTheme(
  mode: ThemeMode = PreferencesStore.themeMode.value,
): "dark" | "light" {
  if (mode === "auto") {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return "light";
  }
  return mode;
}

export function applyTheme(mode: ThemeMode = PreferencesStore.themeMode.value) {
  if (typeof document === "undefined") return;
  const effectiveTheme = getEffectiveTheme(mode);
  document.documentElement.setAttribute("data-bs-theme", effectiveTheme);

  // Initialize and apply M3 dynamic tonal palette
  initDynamicTheme(effectiveTheme === "dark");
}

/** How long the OS color scheme must hold still before it is applied. */
const SCHEME_SETTLE_MS = 300;

let themeListenerStarted = false;
export function initThemeListener() {
  if (typeof window === "undefined" || themeListenerStarted) return;
  themeListenerStarted = true;

  // Apply initially
  applyTheme();

  // Listen to Preference changes
  PreferencesStore.themeMode.subscribe((newMode: ThemeMode) => {
    applyTheme(newMode);
  });

  PreferencesStore.themeSeedColor.subscribe(() => {
    applyTheme();
  });

  // Follow the OS color scheme, but only once it has settled. When an iOS app
  // is sent to the background the system renders it in BOTH light and dark to
  // take its app-switcher snapshots, which fires a burst of color-scheme
  // change events; they are delivered when the app resumes. Applying each one
  // repaints the whole app light/dark/light. So: never react while hidden,
  // wait for the burst to end, then apply only if the scheme really differs.
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    let settleTimer: number | undefined;
    const syncWithSystem = () => {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        if (document.hidden) return; // re-checked when visible again
        if (PreferencesStore.themeMode.value !== "auto") return;
        const applied = document.documentElement.getAttribute("data-bs-theme");
        if (getEffectiveTheme("auto") !== applied) applyTheme("auto");
      }, SCHEME_SETTLE_MS);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", syncWithSystem);
    } else {
      mediaQuery.addListener(syncWithSystem);
    }
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) syncWithSystem();
    });
  }
}
