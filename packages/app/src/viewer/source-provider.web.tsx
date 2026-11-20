import type { ReactNode } from "react";

import { catalogueReads } from "./catalogue-source.web";
import { CatalogueSourceContext } from "./source-context";
import { createCatalogueSources } from "./source-store";

/** Expo can rebuild its root layout; web modules last for the document. */
const documentSources = createCatalogueSources(catalogueReads());

/** The source survives query-only Back; Reload creates a new document scope. */
export function CatalogueSourceProvider({ children }: { children: ReactNode }) {
  return (
    <CatalogueSourceContext.Provider value={documentSources}>
      {children}
    </CatalogueSourceContext.Provider>
  );
}
