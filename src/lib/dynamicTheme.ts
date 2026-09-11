/**
 * Material 3 Expressive Dynamic Theme Engine
 * Automatically detects Android 12+ Monet wallpaper/system accent color
 * from CSS AccentColor or Expo native bridge and generates full M3 tonal palettes.
 * Falls back to Medical Blue (#006590) when dynamic color is unavailable.
 */

import { PreferencesStore } from "../storage/preferencesStore";

export const MEDICAL_BLUE_SEED = "#006590";

export interface M3SeedPreset {
  id: string;
  name: string;
  hex: string;
  desc?: string;
}

export const M3_SEED_PRESETS: M3SeedPreset[] = [
  { id: "red", name: "Crimson Red", hex: "#ba1a1a", desc: "Material 3 Red" },
  { id: "blue", name: "Medical Blue", hex: "#006590", desc: "Baseline Blue" },
  { id: "indigo", name: "Ocean Indigo", hex: "#285ea7", desc: "Deep Ocean" },
  { id: "pink", name: "Rose Pink", hex: "#b32b6e", desc: "Vibrant Rose" },
  { id: "violet", name: "Deep Violet", hex: "#6750a4", desc: "Material Violet" },
  { id: "green", name: "Forest Green", hex: "#386a20", desc: "Natural Green" },
  { id: "amber", name: "Sunset Amber", hex: "#825500", desc: "Warm Amber" },
];

export interface M3Palette {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  outline: string;
  outlineVariant: string;
}

// Global active seed tracking
let currentActiveSeed: string = MEDICAL_BLUE_SEED;
let isDynamicActive: boolean = false;

export function getIsDynamicColorActive(): boolean {
  return isDynamicActive;
}

export function getActiveSeedColor(): string {
  return currentActiveSeed;
}

/**
 * Convert Hex to RGB
 */
export function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace("#", "").trim();
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return [r, g, b];
  }
  const num = parseInt(cleaned, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Convert RGB to Hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;
  s /= 100;
  l /= 100;

  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1 / 3);

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Generate Material 3 Tonal Step based on Hue, Chroma/Saturation, and Target Tone
 */
function tonalColor(h: number, s: number, targetTone: number): string {
  const [r, g, b] = hslToRgb(h, s, targetTone);
  return rgbToHex(r, g, b);
}

/**
 * Mathematically generate an authentic Material 3 tonal palette
 * from any seed color for either light or dark mode.
 */
export function generateM3TonalPalette(seedHex: string, isDark: boolean): M3Palette {
  const [r, g, b] = hexToRgb(seedHex);
  const [h, s] = rgbToHsl(r, g, b);

  // M3 Hue adjustments for harmonious secondary & tertiary roles
  const primarySat = Math.max(35, Math.min(85, s));
  const secondarySat = Math.max(12, Math.min(30, s * 0.4));
  const tertiaryHue = (h + 60) % 360;
  const tertiarySat = Math.max(25, Math.min(65, s * 0.7));
  const neutralSat = 6;
  const neutralVariantSat = 10;

  if (!isDark) {
    // Light Mode M3 Tonal Palette
    return {
      primary: tonalColor(h, primarySat, 36),
      onPrimary: "#ffffff",
      primaryContainer: tonalColor(h, primarySat, 90),
      onPrimaryContainer: tonalColor(h, primarySat, 12),

      secondary: tonalColor(h, secondarySat, 38),
      onSecondary: "#ffffff",
      secondaryContainer: tonalColor(h, secondarySat, 90),
      onSecondaryContainer: tonalColor(h, secondarySat, 14),

      tertiary: tonalColor(tertiaryHue, tertiarySat, 38),
      onTertiary: "#ffffff",
      tertiaryContainer: tonalColor(tertiaryHue, tertiarySat, 92),
      onTertiaryContainer: tonalColor(tertiaryHue, tertiarySat, 14),

      error: "#ba1a1a",
      onError: "#ffffff",
      errorContainer: "#ffdad6",
      onErrorContainer: "#410002",

      surface: tonalColor(h, neutralSat, 98),
      onSurface: tonalColor(h, neutralSat, 12),
      surfaceVariant: tonalColor(h, neutralVariantSat, 90),
      onSurfaceVariant: tonalColor(h, neutralVariantSat, 32),

      surfaceContainerLowest: "#ffffff",
      surfaceContainerLow: tonalColor(h, neutralSat, 96),
      surfaceContainer: tonalColor(h, neutralSat, 93),
      surfaceContainerHigh: tonalColor(h, neutralSat, 90),
      surfaceContainerHighest: tonalColor(h, neutralSat, 87),

      outline: tonalColor(h, neutralVariantSat, 48),
      outlineVariant: tonalColor(h, neutralVariantSat, 80),
    };
  } else {
    // Dark Mode M3 Tonal Palette
    return {
      primary: tonalColor(h, primarySat, 78),
      onPrimary: tonalColor(h, primarySat, 18),
      primaryContainer: tonalColor(h, primarySat, 28),
      onPrimaryContainer: tonalColor(h, primarySat, 90),

      secondary: tonalColor(h, secondarySat, 75),
      onSecondary: tonalColor(h, secondarySat, 18),
      secondaryContainer: tonalColor(h, secondarySat, 28),
      onSecondaryContainer: tonalColor(h, secondarySat, 88),

      tertiary: tonalColor(tertiaryHue, tertiarySat, 76),
      onTertiary: tonalColor(tertiaryHue, tertiarySat, 20),
      tertiaryContainer: tonalColor(tertiaryHue, tertiarySat, 30),
      onTertiaryContainer: tonalColor(tertiaryHue, tertiarySat, 90),

      error: "#ffb4ab",
      onError: "#690005",
      errorContainer: "#93000a",
      onErrorContainer: "#ffdad6",

      surface: tonalColor(h, neutralSat, 8),
      onSurface: tonalColor(h, neutralSat, 88),
      surfaceVariant: tonalColor(h, neutralVariantSat, 28),
      onSurfaceVariant: tonalColor(h, neutralVariantSat, 78),

      surfaceContainerLowest: tonalColor(h, neutralSat, 5),
      surfaceContainerLow: tonalColor(h, neutralSat, 10),
      surfaceContainer: tonalColor(h, neutralSat, 13),
      surfaceContainerHigh: tonalColor(h, neutralSat, 17),
      surfaceContainerHighest: tonalColor(h, neutralSat, 22),

      outline: tonalColor(h, neutralVariantSat, 58),
      outlineVariant: tonalColor(h, neutralVariantSat, 32),
    };
  }
}

const SPOOFED_FALLBACKS = new Set([
  "#000000",
  "#ffffff",
  "#0075ff", // Chromium kDefaultAccentColor
  "#1a73e8", // Google Blue
  "#0067b8", // Microsoft Edge Blue
  "#0061e0", // Firefox default
  "#0078d7", // Windows 10 default
]);

/**
 * Check if the browser or Android WebView provides a native Monet AccentColor
 */
export function detectDeviceSeedColor(): string | null {
  if (typeof window === "undefined" || typeof document === "undefined") return null;

  try {
    const testEl = document.createElement("div");
    testEl.style.color = "AccentColor";
    testEl.style.position = "absolute";
    testEl.style.left = "-9999px";
    testEl.style.top = "-9999px";
    document.body.appendChild(testEl);

    const computed = window.getComputedStyle(testEl).color;
    document.body.removeChild(testEl);

    if (computed && computed !== "rgba(0, 0, 0, 0)") {
      const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const hex = rgbToHex(Number(match[1]), Number(match[2]), Number(match[3]));
        // Avoid generic black, pure white, or Chromium's hardcoded anti-fingerprinting fallbacks
        if (!SPOOFED_FALLBACKS.has(hex.toLowerCase())) {
          return hex;
        }
      }
    }
  } catch {
    // Unsupported or restricted environment
  }

  return null;
}

/**
 * Resolves the active seed hex and dynamic status based on PreferencesStore
 */
export function resolveActiveSeed(
  preferredSeed: string = PreferencesStore.themeSeedColor.value
): { seedHex: string; isDynamic: boolean } {
  if (!preferredSeed || preferredSeed === "system") {
    const detected = detectDeviceSeedColor();
    if (detected) {
      return { seedHex: detected, isDynamic: true };
    }
    return { seedHex: MEDICAL_BLUE_SEED, isDynamic: false };
  }

  if (preferredSeed.startsWith("#")) {
    return { seedHex: preferredSeed, isDynamic: false };
  }

  const preset = M3_SEED_PRESETS.find((p) => p.id === preferredSeed);
  if (preset) {
    return { seedHex: preset.hex, isDynamic: false };
  }

  return { seedHex: MEDICAL_BLUE_SEED, isDynamic: false };
}

/**
 * Change the preferred seed color in PreferencesStore
 */
export function setThemeSeedColor(seed: string) {
  PreferencesStore.themeSeedColor.value = seed;
}

/**
 * Apply the generated M3 palette as CSS custom properties on documentElement
 */
export function applyM3PaletteToDocument(palette: M3Palette, isDark?: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  root.style.setProperty("--md-sys-color-primary", palette.primary);
  root.style.setProperty("--md-sys-color-on-primary", palette.onPrimary);
  root.style.setProperty("--md-sys-color-primary-container", palette.primaryContainer);
  root.style.setProperty("--md-sys-color-on-primary-container", palette.onPrimaryContainer);

  root.style.setProperty("--md-sys-color-secondary", palette.secondary);
  root.style.setProperty("--md-sys-color-on-secondary", palette.onSecondary);
  root.style.setProperty("--md-sys-color-secondary-container", palette.secondaryContainer);
  root.style.setProperty("--md-sys-color-on-secondary-container", palette.onSecondaryContainer);

  root.style.setProperty("--md-sys-color-tertiary", palette.tertiary);
  root.style.setProperty("--md-sys-color-on-tertiary", palette.onTertiary);
  root.style.setProperty("--md-sys-color-tertiary-container", palette.tertiaryContainer);
  root.style.setProperty("--md-sys-color-on-tertiary-container", palette.onTertiaryContainer);

  root.style.setProperty("--md-sys-color-error", palette.error);
  root.style.setProperty("--md-sys-color-on-error", palette.onError);
  root.style.setProperty("--md-sys-color-error-container", palette.errorContainer);
  root.style.setProperty("--md-sys-color-on-error-container", palette.onErrorContainer);

  root.style.setProperty("--md-sys-color-surface", palette.surface);
  root.style.setProperty("--md-sys-color-on-surface", palette.onSurface);
  root.style.setProperty("--md-sys-color-surface-variant", palette.surfaceVariant);
  root.style.setProperty("--md-sys-color-on-surface-variant", palette.onSurfaceVariant);

  root.style.setProperty("--md-sys-color-surface-container-lowest", palette.surfaceContainerLowest);
  root.style.setProperty("--md-sys-color-surface-container-low", palette.surfaceContainerLow);
  root.style.setProperty("--md-sys-color-surface-container", palette.surfaceContainer);
  root.style.setProperty("--md-sys-color-surface-container-high", palette.surfaceContainerHigh);
  root.style.setProperty("--md-sys-color-surface-container-highest", palette.surfaceContainerHighest);

  root.style.setProperty("--md-sys-color-outline", palette.outline);
  root.style.setProperty("--md-sys-color-outline-variant", palette.outlineVariant);

  // App Aliases
  root.style.setProperty("--app-bg", palette.surface);
  root.style.setProperty("--app-surface", palette.surfaceContainerLow);
  root.style.setProperty("--app-surface-muted", palette.surfaceContainer);
  root.style.setProperty("--app-border", palette.outlineVariant);
  root.style.setProperty("--app-text", palette.onSurface);
  root.style.setProperty("--app-text-muted", palette.onSurfaceVariant);
  root.style.setProperty("--app-primary", palette.primary);
  root.style.setProperty("--app-primary-container", palette.primaryContainer);

  // Bootstrap bridge
  root.style.setProperty("--bs-primary", palette.primary);
  const [pr, pg, pb] = hexToRgb(palette.primary);
  root.style.setProperty("--bs-primary-rgb", `${pr}, ${pg}, ${pb}`);

  // Sync meta theme-color with surface for Android status bar
  const metaTags = document.querySelectorAll('meta[name="theme-color"]');
  metaTags.forEach((tag) => tag.setAttribute("content", palette.surface));

  // Notify native Expo / React Native shell of theme update
  if (typeof window !== "undefined" && (window as any).ReactNativeWebView) {
    try {
      const dark =
        isDark !== undefined
          ? isDark
          : document.documentElement.getAttribute("data-bs-theme") === "dark";
      (window as any).ReactNativeWebView.postMessage(
        JSON.stringify({
          type: "THEME_UPDATE",
          isDark: dark,
          surfaceColor: palette.surface,
          navBarColor: palette.surfaceContainer,
        })
      );
    } catch {
      // Ignore
    }
  }
}

/**
 * Initialize dynamic theme listener and apply theme
 */
export function initDynamicTheme(isDark: boolean): M3Palette {
  const { seedHex, isDynamic } = resolveActiveSeed();
  currentActiveSeed = seedHex;
  isDynamicActive = isDynamic;

  // Listen for ExpoApp Android native messages
  if (typeof window !== "undefined" && !(window as any).__hasAndroidThemeListener) {
    (window as any).__hasAndroidThemeListener = true;
    window.addEventListener("message", (event) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data && data.type === "ANDROID_DYNAMIC_COLOR" && data.seedColor) {
          if (PreferencesStore.themeSeedColor.value === "system") {
            currentActiveSeed = data.seedColor;
            isDynamicActive = true;
            const dark =
              typeof document !== "undefined"
                ? document.documentElement.getAttribute("data-bs-theme") === "dark"
                : isDark;
            const newPalette = generateM3TonalPalette(currentActiveSeed, dark);
            applyM3PaletteToDocument(newPalette, dark);
          }
        }
      } catch {
        // Ignore non-json messages
      }
    });
  }

  const palette = generateM3TonalPalette(currentActiveSeed, isDark);
  applyM3PaletteToDocument(palette, isDark);
  return palette;
}
