import type { ReactNode } from "react";

export default function Card({ children }: { children: ReactNode }) {
  return (
    <div className="card mb-4">
      <div className="card-body">{children}</div>
    </div>
  );
}
