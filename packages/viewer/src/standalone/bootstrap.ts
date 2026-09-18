/** Serializable state shared by standalone shell SSR and browser hydration. */

import { readCatalogue } from "../catalogue/reader.js";
import type { CatalogueReadModel } from "../catalogue/types.js";
import {
  parseStaticDelivery,
  type StaticDelivery,
} from "../navigation/delivery.js";
import { isLogicalFragment } from "../navigation/logical.js";
import type { ShellContext } from "../shell/context.js";
import { toRouteTarget } from "../shell/target.js";
import type { ShellView } from "../shell/views.js";
import { viewerCatalogue, viewerContext } from "../viewer/projection.js";
import { defaultSelection } from "../viewer/selection.js";

type BootstrapView =
  | { kind: "home" }
  | { kind: "missing"; requested: string }
  | { kind: "target"; route: string };

interface BootstrapContext {
  base: string;
  updateVersion: number;
  contentVersion?: number;
  previewGeneration?: string;
  comparisons: boolean;
  delivery?: StaticDelivery;
  fragment?: string;
}

/** Public-catalogue state embedded in one server-rendered standalone page. */
export interface ShellBootstrap {
  catalogue: CatalogueReadModel;
  context: BootstrapContext;
  view: BootstrapView;
}

/** Build the browser-safe hydration state from an accepted server snapshot. */
export function shellBootstrap(
  catalogue: CatalogueReadModel,
  view: ShellView,
  context: ShellContext,
): ShellBootstrap {
  return {
    catalogue,
    context: {
      base: context.base,
      updateVersion: context.updateVersion,
      comparisons: context.comparisons ?? false,
      ...(context.contentVersion === undefined
        ? {}
        : { contentVersion: context.contentVersion }),
      ...(context.previewGeneration === undefined
        ? {}
        : { previewGeneration: context.previewGeneration }),
      ...(context.delivery === undefined ? {} : { delivery: context.delivery }),
      ...(context.fragment === undefined ? {} : { fragment: context.fragment }),
    },
    view:
      view.kind === "target"
        ? { kind: "target", route: view.target.entry.route }
        : view.kind === "missing"
          ? { kind: "missing", requested: view.requested }
          : { kind: "home" },
  };
}

/** Validate embedded JSON before it can select routes or delivery metadata. */
export function readShellBootstrap(value: unknown): ShellBootstrap {
  if (!isRecord(value) || !isRecord(value.context) || !isRecord(value.view))
    throw new Error("Invalid shell hydration state.");
  const catalogue = readCatalogue(value.catalogue);
  const context = readContext(value.context);
  const view = readView(value.view);
  if (
    view.kind === "target" &&
    !catalogueEntryRoutes(catalogue).has(view.route)
  )
    throw new Error("Invalid shell hydration target.");
  return { catalogue, context, view };
}

/** Recreate the exact component inputs used by standalone SSR. */
export function shellBootstrapProps(bootstrap: ShellBootstrap) {
  const catalogue = viewerCatalogue(bootstrap.catalogue);
  const selectedEntry =
    bootstrap.view.kind === "target"
      ? catalogue.byRoute.get(bootstrap.view.route)
      : undefined;
  const selectedId = selectedEntry?.id ?? null;
  const selection = { ...defaultSelection, screenId: selectedId };
  const projected = viewerContext(bootstrap.catalogue, selection);
  const context: ShellContext = {
    ...projected,
    base: bootstrap.context.base,
    updateVersion: bootstrap.context.updateVersion,
    comparisons: bootstrap.context.comparisons,
    reactShell: true,
    ...(bootstrap.context.contentVersion === undefined
      ? {}
      : { contentVersion: bootstrap.context.contentVersion }),
    ...(bootstrap.context.previewGeneration === undefined
      ? {}
      : { previewGeneration: bootstrap.context.previewGeneration }),
    ...(bootstrap.context.delivery === undefined
      ? {}
      : { delivery: bootstrap.context.delivery }),
    ...(bootstrap.context.fragment === undefined
      ? {}
      : { fragment: bootstrap.context.fragment }),
    ...(bootstrap.view.kind === "target"
      ? { activeRoute: bootstrap.view.route }
      : {}),
  };
  const view: ShellView =
    bootstrap.view.kind === "home"
      ? { kind: "home" }
      : bootstrap.view.kind === "missing"
        ? bootstrap.view
        : targetView(catalogue, bootstrap.view.route);
  return { catalogue, context, view };
}

/** Adopt the finalized authenticated descriptor over static staging values. */
export function shellBootstrapWithDelivery(
  bootstrap: ShellBootstrap,
  delivery: StaticDelivery,
): ShellBootstrap {
  return {
    ...bootstrap,
    catalogue: { ...bootstrap.catalogue, deploymentId: delivery.deploymentId },
    context: { ...bootstrap.context, delivery },
  };
}

function readContext(value: Record<string, unknown>): BootstrapContext {
  if (
    typeof value["base"] !== "string" ||
    !isVersion(value["updateVersion"]) ||
    typeof value["comparisons"] !== "boolean"
  )
    throw new Error("Invalid shell hydration context.");
  const contentVersion = value["contentVersion"];
  const previewGeneration = value["previewGeneration"];
  const fragment = value["fragment"];
  if (contentVersion !== undefined && !isVersion(contentVersion))
    throw new Error("Invalid shell content version.");
  if (previewGeneration !== undefined && typeof previewGeneration !== "string")
    throw new Error("Invalid shell preview generation.");
  if (fragment !== undefined && !isLogicalFragment(fragment))
    throw new Error("Invalid shell fragment.");
  const delivery =
    value["delivery"] === undefined
      ? undefined
      : parseStaticDelivery(value["delivery"]);
  if (value["delivery"] !== undefined && !delivery)
    throw new Error("Invalid shell delivery metadata.");
  return {
    base: value["base"],
    updateVersion: value["updateVersion"],
    comparisons: value["comparisons"],
    ...(contentVersion === undefined ? {} : { contentVersion }),
    ...(previewGeneration === undefined ? {} : { previewGeneration }),
    ...(delivery === undefined ? {} : { delivery }),
    ...(fragment === undefined ? {} : { fragment }),
  };
}

function readView(value: Record<string, unknown>): BootstrapView {
  if (value["kind"] === "home") return { kind: "home" };
  if (value["kind"] === "missing" && typeof value["requested"] === "string")
    return { kind: "missing", requested: value["requested"] };
  if (value["kind"] === "target" && typeof value["route"] === "string")
    return { kind: "target", route: value["route"] };
  throw new Error("Invalid shell hydration view.");
}

function targetView(
  catalogue: ReturnType<typeof viewerCatalogue>,
  route: string,
): ShellView {
  const entry = catalogue.byRoute.get(route);
  const target = entry && toRouteTarget(entry);
  if (!target) throw new Error("Invalid shell hydration target.");
  return { kind: "target", target };
}

function catalogueEntryRoutes(catalogue: CatalogueReadModel): Set<string> {
  return new Set(
    [
      ...catalogue.screens,
      ...catalogue.pages,
      ...catalogue.useCases,
      ...catalogue.components,
      ...catalogue.removedEntries.map(({ entry }) => entry),
    ].map(({ route }) => route),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}
