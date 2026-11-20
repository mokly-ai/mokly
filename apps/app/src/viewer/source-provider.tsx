import type { ReactNode } from "react";

/** Native hosts load the web route and never create the DOM catalogue source. */
export function CatalogueSourceProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
