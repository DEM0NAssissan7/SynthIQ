import { PreferencesStore } from "../storage/preferencesStore";

export type ThemeMode = "auto" | "dark" | "light";

export function getEffectiveTheme(
  mode: ThemeMode = PreferencesStore.themeMode.value
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

export function applyTheme(
  mode: ThemeMode = PreferencesStore.themeMode.value
) {
  if (typeof document === "undefined") return;
  const effectiveTheme = getEffectiveTheme(mode);
  document.documentElement.setAttribute("data-bs-theme", effectiveTheme);
}

export function initThemeListener() {
  if (typeof window === "undefined") return;

  // Apply initially
  applyTheme();

  // Listen to Preference changes
  PreferencesStore.themeMode.subscribe((newMode: ThemeMode) => {
    applyTheme(newMode);
  });

  // Listen to OS system color scheme changes
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (PreferencesStore.themeMode.value === "auto") {
        applyTheme("auto");
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", onChange);
    } else {
      mediaQuery.addListener(onChange);
    }
  }
}
