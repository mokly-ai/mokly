import React, { type ReactNode } from "react";

export function View({ children, ...props }: { children: ReactNode }) {
  return <section {...props}>{children}</section>;
}
