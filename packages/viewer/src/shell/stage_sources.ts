/** Source and usage projection for saved and temporary stage views. */

import type { BranchPointPath, CurrentPath } from "../catalogue/path_types.js";
import type {
  AnyShellCatalogueUsage,
  AnyShellCatalogueView,
} from "../catalogue/scoped_types.js";
import type { CatalogueUsage } from "../catalogue/types.js";
import { encodeUrlPath } from "../data/paths.js";
import { viewRoute } from "../navigation/routes.js";

import type { ShellGeneratedView, ShellUsage } from "./usage_types.js";

export const unavailableUsage: CatalogueUsage<CurrentPath | BranchPointPath> = {
  status: "unavailable",
};
const pendingUsage: CatalogueUsage<CurrentPath | BranchPointPath> = {
  status: "pending",
};
const generatedUsages = new WeakMap<
  ShellUsage,
  CatalogueUsage<CurrentPath | BranchPointPath>
>();

export function framePath(path: string, fragment?: string): string {
  const source = `/${encodeUrlPath(path)}`;
  return fragment ? `${source}#${encodeURIComponent(fragment)}` : source;
}

export function frameSource(
  entry: { path: string; kind: "component" | "screen" },
  view: AnyShellCatalogueView | undefined,
  fragment?: string,
  stepIndex?: number,
): string | undefined {
  if (!view) return;
  return framePath(
    `static/${viewRoute(entry.path, view.viewport, view.colorScheme)}`,
    stepIndex === undefined || stepIndex === 0 ? fragment : undefined,
  );
}

/** Normalize bootstrap-only omission to the frame's existing pending state. */
export function shellFrameUsage(
  usage: AnyShellCatalogueUsage | undefined,
): CatalogueUsage<CurrentPath | BranchPointPath> {
  if (!usage) return unavailableUsage;
  return usage.status === "omitted" ? pendingUsage : usage;
}

export function generatedView(
  views: readonly ShellGeneratedView[] | undefined,
  variantPath: string | undefined,
  viewport: "desktop" | "mobile",
  colorScheme: "dark" | "light",
): ShellGeneratedView | undefined {
  return views?.find(
    (view) =>
      view.viewport === viewport &&
      view.colorScheme === colorScheme &&
      (view.variantPath === undefined || view.variantPath === variantPath),
  );
}

export function generatedFrameSource(
  view: ShellGeneratedView,
  fragment?: string,
  stepIndex?: number,
): string {
  const source = view.path.startsWith("/")
    ? view.path
    : `/static/${encodeUrlPath(view.path)}`;
  return fragment && (stepIndex === undefined || stepIndex === 0)
    ? `${source}#${encodeURIComponent(fragment)}`
    : source;
}

export function generatedUsage(
  view: ShellGeneratedView,
): CatalogueUsage<CurrentPath | BranchPointPath> {
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
