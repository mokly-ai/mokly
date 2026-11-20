import type { ReactNode } from "react";

/** Catalogue navigation stays below the artboard and outside the product screen. */
export function CatalogueLinks({ children }: { children: ReactNode }) {
  return (
    <nav className="catalogue-links" aria-label="Related catalogue screens">
      {children}
    </nav>
  );
}
