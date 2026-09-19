import React, { type ReactNode } from "react";

export function Card({ children }: { children: ReactNode }) {
  return <section data-packed-card="">{children}</section>;
}
