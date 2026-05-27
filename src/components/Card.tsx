import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export default function Card({
  children,
  className = "",
  bodyClassName = "",
}: CardProps) {
  return (
    <div className={`card app-card border-0 shadow-sm mb-3 ${className}`.trim()}>
      <div className={`card-body ${bodyClassName}`.trim()}>{children}</div>
    </div>
  );
}
