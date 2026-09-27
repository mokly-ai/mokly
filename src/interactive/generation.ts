/** Current-generation view identity used by the interactive HTTP boundary. */

import { generatedViews } from "@mokly/viewer/data";
import type { Catalogue } from "@mokly/viewer/server";

import type { ComponentRuntime } from "../build/component_runtime.js";
import type { ResolvedConfig } from "../config/types.js";
import type { DocumentService } from "../server/demand/service.js";

import type { InteractiveSourceEntry } from "./route_table.js";

/** One generated screen or saved component view eligible for Live selection. */
export interface InteractiveViewTarget {
  colorScheme: "dark" | "light";
  entryId: string;
  route: string;
  variantId?: string;
  viewport: "desktop" | "mobile";
}

/** Retained inputs that must agree for a composed Live document. */
export interface InteractiveGeneration {
  catalogue: Catalogue;
  config: ResolvedConfig;
  documents: DocumentService;
  entries: readonly InteractiveSourceEntry[];
  generatedRoutes: ReadonlySet<string>;
  generation: string;
  views: ReadonlyMap<string, InteractiveViewTarget>;
}

/** Origins that may participate in one Live frame-adapter handshake. */
export interface InteractiveViewQueryOrigins {
  appPort: number;
  frameOrigin: string;
  forwarded: boolean;
}

/** Pair one accepted runtime with its catalogue and on-demand compiler. */
export function interactiveGeneration(
  runtime: ComponentRuntime,
  catalogue: Catalogue,
  documents: DocumentService,
): InteractiveGeneration {
  const entries = runtime.manifest.entries.map((entry) => {
    if (entry.kind !== "screen" && entry.kind !== "component") return entry;
    const interactive = runtime.interactiveEntries[entry.id];
    if (typeof interactive !== "boolean")
      throw new Error(`Live runtime is missing eligibility for ${entry.id}`);
    return { ...entry, interactive };
  });
  const views = new Map<string, InteractiveViewTarget>();
  for (const entry of runtime.manifest.entries) {
    if (entry.kind !== "screen" && entry.kind !== "component") continue;
    for (const view of generatedViews(entry))
      views.set(view.path, {
        colorScheme: view.colorScheme,
        entryId: entry.id,
        route: view.path,
        ...(view.variantId ? { variantId: view.variantId } : {}),
        viewport: view.viewport,
      });
  }
  return {
    catalogue,
    config: runtime.config,
    documents,
    entries,
    generatedRoutes: documents.routes,
    generation: runtime.generation,
    views,
  };
}

/** Validate optional redundant axes without allowing arbitrary query data. */
export function validateInteractiveViewQuery(
  search: URLSearchParams,
  target: InteractiveViewTarget,
  origins: InteractiveViewQueryOrigins,
): "invalid" | "not-found" | "valid" {
  const allowed = new Set(["mokly-host", "scheme", "variant", "viewport"]);
  if ([...search.keys()].some((key) => !allowed.has(key))) return "invalid";
  for (const key of allowed)
    if (search.getAll(key).length > 1) return "invalid";
  const viewport = search.get("viewport");
  if (viewport !== null && viewport !== "mobile" && viewport !== "desktop")
    return "invalid";
  const scheme = search.get("scheme");
  if (scheme !== null && scheme !== "light" && scheme !== "dark")
    return "invalid";
  const variant = search.get("variant");
  if (variant !== null && !variant) return "invalid";
  const host = search.get("mokly-host");
  if (host !== null && !validHostOrigin(host, origins)) return "invalid";
  if (
    (viewport !== null && viewport !== target.viewport) ||
    (scheme !== null && scheme !== target.colorScheme) ||
    (variant !== null && variant !== target.variantId)
  )
    return "not-found";
  return "valid";
}

function validHostOrigin(
  value: string,
  origins: InteractiveViewQueryOrigins,
): boolean {
  if (value.length > 2048) return false;
  try {
    if (!/^https?:/.test(value) || new URL(value).origin !== value)
      return false;
  } catch {
    return false;
  }
  if (value === origins.frameOrigin) return false;
  return (
    origins.forwarded ||
    value === new URL(`http://localhost:${String(origins.appPort)}`).origin ||
    value === new URL(`http://127.0.0.1:${String(origins.appPort)}`).origin
  );
}
