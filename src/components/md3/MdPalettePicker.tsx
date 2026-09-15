import { useState, useRef } from "react";
import { PreferencesStore } from "../../storage/preferencesStore";
import {
  M3_SEED_PRESETS,
  getIsDynamicColorActive,
  getActiveSeedColor,
  setThemeSeedColor,
} from "../../lib/dynamicTheme";
import MdIcon from "./MdIcon";

interface MdPalettePickerProps {
  className?: string;
  compact?: boolean;
}

export default function MdPalettePicker({
  className = "",
  compact = false,
}: MdPalettePickerProps) {
  const [preferredSeed, setPreferredSeed] =
    PreferencesStore.themeSeedColor.useState();
  const colorInputRef = useRef<HTMLInputElement>(null);

  const isDynamicActive = getIsDynamicColorActive();
  const activeSeed = getActiveSeedColor();

  const isCustomColor =
    preferredSeed.startsWith("#") &&
    !M3_SEED_PRESETS.some(
      (p) => p.hex.toLowerCase() === preferredSeed.toLowerCase()
    );

  const [customHex, setCustomHex] = useState(() =>
    isCustomColor ? preferredSeed : activeSeed
  );

  const handleSelectPreset = (hex: string) => {
    setPreferredSeed(hex);
    setThemeSeedColor(hex);
  };

  const handleSelectSystem = () => {
    setPreferredSeed("system");
    setThemeSeedColor("system");
  };

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomHex(val);
    setPreferredSeed(val);
    setThemeSeedColor(val);
  };

  return (
    <div className={`md3-palette-picker ${className}`.trim()}>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <span className="fw-semibold small text-muted text-uppercase tracking-wider">
          Material You Palette
        </span>
        {isDynamicActive && (
          <span className="badge rounded-pill bg-success-subtle text-success border border-success-subtle small px-2 py-1 d-inline-flex align-items-center gap-1">
            <MdIcon name="check_circle" size={14} />
            System Synced
          </span>
        )}
      </div>

      {/* Preset Swatches Grid */}
      <div className="md3-palette-grid mb-3">
        {M3_SEED_PRESETS.map((preset) => {
          const isSelected =
            preferredSeed.toLowerCase() === preset.hex.toLowerCase();
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelectPreset(preset.hex)}
              className={`md3-palette-swatch ${isSelected ? "active" : ""}`}
              title={`${preset.name} (${preset.hex})`}
              aria-label={preset.name}
              aria-pressed={isSelected}
            >
              <div
                className="md3-palette-dot"
                style={{ backgroundColor: preset.hex }}
              >
                {isSelected && (
                  <MdIcon name="check" size={18} style={{ color: "#ffffff" }} />
                )}
              </div>
              <span className="md3-palette-label">{preset.name}</span>
            </button>
          );
        })}
      </div>

      {/* Action Chips: System Auto & Custom Hex */}
      <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
        <button
          type="button"
          onClick={handleSelectSystem}
          className={`md3-palette-action-btn ${
            preferredSeed === "system" ? "active" : ""
          }`}
          title="Auto-detect from OS wallpaper (ChromeOS/Android/PWA)"
        >
          <MdIcon name="auto_awesome" size={18} />
          <span>System (Auto)</span>
        </button>

        <button
          type="button"
          onClick={() => colorInputRef.current?.click()}
          className={`md3-palette-action-btn ${isCustomColor ? "active" : ""}`}
          title="Pick any custom hex color or sample from wallpaper"
        >
          <div
            className="md3-palette-color-preview"
            style={{ backgroundColor: isCustomColor ? customHex : activeSeed }}
          />
          <span>Custom Hex</span>
          <input
            ref={colorInputRef}
            type="color"
            value={customHex.startsWith("#") ? customHex : "#ba1a1a"}
            onChange={handleCustomColorChange}
            className="visually-hidden"
            aria-label="Custom Theme Color Picker"
          />
        </button>
      </div>

      {/* Informative Note for Chrome/Chromebook Sandbox */}
      {!compact && (
        <div className="md3-palette-hint small text-muted mt-2 p-2 rounded-3">
          <div className="d-flex gap-2 align-items-start">
            <span className="text-primary" style={{ marginTop: "2px" }}>
              <MdIcon name="info" size={18} />
            </span>
            <span>
              Chromium protects privacy by isolating web tabs from OS wallpaper colors.
              Select <strong>Crimson Red</strong> above to match your Chromebook theme,
              or install SynthIQ as a PWA for direct system accent access.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
