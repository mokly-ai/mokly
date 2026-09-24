/** Source and usage projection for saved and temporary stage views. */

import {
  currentDocumentPath,
  type GeneratedPathPrefix,
} from "../catalogue/delivery_paths.js";
import type { CatalogueUsage, CatalogueView } from "../catalogue/types.js";
import type { ComponentViewRecord } from "../components/manifest_types.js";
import type { GeneratedComponentView } from "../components/views.js";
import { encodeUrlPath } from "../data/paths.js";

export const unavailableUsage: CatalogueUsage = { status: "unavailable" };
const generatedUsages = new WeakMap<ComponentViewRecord, CatalogueUsage>();

export function framePath(path: string, fragment?: string): string {
  const source = `/${encodeUrlPath(path)}`;
  return fragment ? `${source}#${encodeURIComponent(fragment)}` : source;
}

export function frameSource(
  view: CatalogueView | undefined,
  fragment?: string,
  stepIndex?: number,
): string | undefined {
  if (!view?.fragmentPath) return;
  return framePath(
    view.fragmentPath,
    stepIndex === undefined || stepIndex === 0 ? fragment : undefined,
  );
}

export function generatedView(
  views: readonly GeneratedComponentView[] | undefined,
  variantId: string | undefined,
  viewport: "desktop" | "mobile",
  colorScheme: "dark" | "light",
): GeneratedComponentView | undefined {
  return views?.find(
    (view) =>
      view.viewport === viewport &&
      view.colorScheme === colorScheme &&
      (view.variantId === undefined || view.variantId === variantId),
  );
}

export function generatedFrameSource(
  view: GeneratedComponentView,
  fragment?: string,
  stepIndex?: number,
  prefix?: GeneratedPathPrefix,
): string {
  const source = view.path.startsWith("/")
    ? view.path
    : framePath(currentDocumentPath(view.path, prefix));
  return fragment && (stepIndex === undefined || stepIndex === 0)
    ? `${source}#${encodeURIComponent(fragment)}`
    : source;
}

export function generatedUsage(view: GeneratedComponentView): CatalogueUsage {
  const record = view.usage;
  if (!record) return unavailableUsage;
  const current = generatedUsages.get(record);
  if (current) return current;
  const usage = {
    status: "ready" as const,
    instances: record.instances,
    slots: record.slots,
    ranges: record.ranges,
  };
  generatedUsages.set(record, usage);
  return usage;
}

export function resolvedFrameSource(
  source: string | undefined,
  baseUrl: string | URL | undefined,
): string | undefined {
  return source && baseUrl ? new URL(source, baseUrl).href : source;
}
