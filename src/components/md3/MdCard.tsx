import type { HTMLAttributes, ReactNode } from "react";

export type MdCardVariant = "elevated" | "filled" | "outlined";

interface MdCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: MdCardVariant;
  className?: string;
  bodyClassName?: string;
}

export default function MdCard({
  children,
  variant = "elevated",
  className = "",
  bodyClassName = "",
  ...props
}: MdCardProps) {
  let variantStyle = "card app-card mb-3";

  if (variant === "outlined") {
    variantStyle += " border shadow-none";
  } else if (variant === "filled") {
    variantStyle += " border-0 shadow-none";
  } else {
    variantStyle += " border-0 shadow-sm";
  }

  return (
    <div className={`${variantStyle} ${className}`.trim()} {...props}>
      <div className={`card-body ${bodyClassName}`.trim()}>{children}</div>
    </div>
  );
}
