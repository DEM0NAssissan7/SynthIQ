import type { CSSProperties } from "react";

export interface MdIconProps {
  name: string;
  fill?: boolean;
  size?: number | string;
  className?: string;
  style?: CSSProperties;
}

export default function MdIcon({
  name,
  fill = false,
  size = 24,
  className = "",
  style = {},
}: MdIconProps) {
  const sizeValue = typeof size === "number" ? `${size}px` : size;

  return (
    <span
      className={`material-symbols-rounded ${fill ? "fill" : ""} ${className}`.trim()}
      style={{
        fontSize: sizeValue,
        width: sizeValue,
        height: sizeValue,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        ...style,
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
