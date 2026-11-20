import { createContext } from "react";

import type { CatalogueSources } from "./source-store";

/** The web document owns the source when the router reconstructs its child. */
export const CatalogueSourceContext = createContext<
  CatalogueSources | undefined
>(undefined);
