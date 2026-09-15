import fs from "fs";

const icons = JSON.parse(fs.readFileSync("scripts/official_material_symbols.json", "utf8"));

let content = `import type { CSSProperties } from "react";

export interface MdIconProps {
  name: string;
  fill?: boolean;
  size?: number | string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Official Google Material Symbols Rounded SVG vector paths (viewBox: 0 -960 960 960)
 * Extracted directly from google/material-design-icons repository.
 * Provides 100% genuine Google Material Design 3 geometry with zero-latency inline rendering.
 */
const ICON_PATHS: Record<string, { outline: string; fill?: string }> = {
`;

for (const [name, paths] of Object.entries(icons)) {
  content += `  ${JSON.stringify(name)}: {\n`;
  content += `    outline: ${JSON.stringify(paths.outline)},\n`;
  if (paths.fill && paths.fill !== paths.outline) {
    content += `    fill: ${JSON.stringify(paths.fill)},\n`;
  }
  content += `  },\n`;
}

content += `};

export default function MdIcon({
  name,
  fill = false,
  size = 24,
  className = "",
  style = {},
}: MdIconProps) {
  const sizeValue = typeof size === "number" ? \`\${size}px\` : size;
  const normalizedName = name ? name.toLowerCase().replace(/-/g, "_") : "";
  const iconData = ICON_PATHS[normalizedName];

  if (!iconData) {
    return (
      <svg
        viewBox="0 -960 960 960"
        width={sizeValue}
        height={sizeValue}
        fill="currentColor"
        className={\`md3-svg-icon \${className}\`.trim()}
        style={{
          display: "inline-block",
          verticalAlign: "middle",
          flexShrink: 0,
          ...style,
        }}
        aria-hidden="true"
      >
        <circle cx="480" cy="-480" r="200" opacity="0.3" />
      </svg>
    );
  }

  const path = fill && iconData.fill ? iconData.fill : iconData.outline;

  return (
    <svg
      viewBox="0 -960 960 960"
      width={sizeValue}
      height={sizeValue}
      fill="currentColor"
      className={\`md3-svg-icon \${className}\`.trim()}
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        flexShrink: 0,
        ...style,
      }}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}
`;

fs.writeFileSync("src/components/md3/MdIcon.tsx", content, "utf8");
console.log("Successfully generated src/components/md3/MdIcon.tsx with official Google Material Symbols Rounded paths!");
