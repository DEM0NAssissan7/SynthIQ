import type { ButtonHTMLAttributes, ReactNode } from "react";

export type MdButtonVariant =
  | "filled"
  | "tonal"
  | "outlined"
  | "elevated"
  | "text";

interface MdButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: MdButtonVariant;
  icon?: string | ReactNode;
  children: ReactNode;
  className?: string;
  fullWidth?: boolean;
}

export default function MdButton({
  variant = "filled",
  icon,
  children,
  className = "",
  fullWidth = false,
  ...props
}: MdButtonProps) {
  const variantClass = `md3-btn-${variant}`;
  const widthClass = fullWidth ? "w-100" : "";

  return (
    <button
      type="button"
      className={`md3-btn ${variantClass} ${widthClass} ${className}`.trim()}
      {...props}
    >
      {typeof icon === "string" ? <i className={`bi ${icon}`} /> : icon}
      <span>{children}</span>
    </button>
  );
}
