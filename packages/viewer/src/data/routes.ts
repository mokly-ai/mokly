import { isEntryId } from "../navigation/logical.js";

import type { ColorScheme, Viewport } from "./axes.js";

/** Entry kinds with canonical catalogue documents. */
export type EntryRouteKind = "component" | "page" | "screen" | "use-case";

/** Entry kinds that own viewport and color-scheme renderings. */
export type ViewRouteKind = "component" | "screen";

/** Identity parsed from a canonical or provider-normalized shell URL. */
export interface ViewHrefIdentity {
  id: string;
  kind: EntryRouteKind;
}

const PREFIX_BY_KIND: Readonly<Record<EntryRouteKind, string>> = {
  component: "components",
  page: "pages",
  screen: "screens",
  "use-case": "user-flows",
};

const KIND_BY_PREFIX: Readonly<Record<string, EntryRouteKind>> = {
  components: "component",
  pages: "page",
  screens: "screen",
  "user-flows": "use-case",
};

/** Derive an entry's canonical document route from its kind and id. */
export function entryRoute(kind: EntryRouteKind, id: string): string {
  return `${PREFIX_BY_KIND[kind]}/${id}.html`;
}

/** Derive one viewport and color-scheme document from entry identity. */
export function viewRoute(
  kind: ViewRouteKind,
  id: string,
  viewport: Viewport,
  colorScheme: ColorScheme = "light",
): string {
  return fragmentRoute(entryRoute(kind, id), viewport, colorScheme);
}

/** Derive one view document from an already validated entry route. */
export function fragmentRoute(
  route: string,
  viewport: Viewport,
  colorScheme: ColorScheme = "light",
): string {
  const scheme = colorScheme === "dark" ? ".dark" : "";
  return route.replace(/\.html$/, `.${viewport}${scheme}.html`);
}

/** Derive one temporary local component-variant document from its parent route. */
export function componentFragmentRoute(
  route: string,
  variantId: string,
  viewport: Viewport,
  colorScheme: ColorScheme = "light",
): string {
  const scheme = colorScheme === "dark" ? ".dark" : "";
  return route.replace(
    /\.html$/,
    `.variants/${variantId}.${viewport}${scheme}.html`,
  );
}

/** Derive the canonical shell URL for an entry. */
export function viewHref(kind: EntryRouteKind, id: string): string {
  return `/view/${entryRoute(kind, id)}`;
}

/** Parse a canonical or provider-normalized `/view/<route>` pathname. */
export function parseViewHref(value: string): ViewHrefIdentity | undefined {
  const match = /^\/view\/([^/]+)\/([^/]+?)(?:\.html)?$/.exec(value);
  if (!match) return undefined;
  const prefix = match[1] ?? "";
  const id = match[2] ?? "";
  const kind = KIND_BY_PREFIX[prefix];
  if (!kind || !isEntryId(id)) return undefined;
  return { id, kind };
}
