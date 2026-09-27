import type { ColorScheme, Viewport } from "@mokly/viewer";

/** One logical catalogue destination resolved for the current view axes. */
export interface InteractiveRoute {
  href: string;
}

/** Browser-safe logical destination table embedded in a Live document. */
export type InteractiveRouteTable = Readonly<Record<string, InteractiveRoute>>;

/** Canonical browser bootstrap for one generation-scoped Live document. */
export interface InteractiveBootstrap {
  colorScheme: ColorScheme;
  entryId: string;
  entryKind: "component" | "screen";
  generation: string;
  routes: InteractiveRouteTable;
  variantId?: string;
  viewport: Viewport;
}
