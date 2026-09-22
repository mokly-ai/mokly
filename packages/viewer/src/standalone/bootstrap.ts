/** Serializable state shared by standalone shell SSR and browser hydration. */

import { resolveCatalogueRoute } from "../catalogue/entry_selection.js";
import { readCatalogue } from "../catalogue/reader.js";
import type { CatalogueReadModel } from "../catalogue/types.js";
import { canonicalJson } from "../components/data.js";
import {
  parseStaticDelivery,
  type StaticDelivery,
} from "../navigation/delivery.js";
import { isLogicalFragment } from "../navigation/logical.js";
import { catalogueRouteEntry } from "../shell/catalogue.js";
import type { ShellContext } from "../shell/context.js";
import { toRouteTarget } from "../shell/target.js";
import type { ShellView } from "../shell/views.js";
import { viewerCatalogue, viewerContext } from "../viewer/projection.js";
import { defaultSelection } from "../viewer/selection.js";

import {
  catalogueReferenceMatches,
  externalCatalogueReference,
  isExternalCatalogueReference,
  readExternalCatalogueReference,
  type ExternalCatalogueReference,
} from "./catalogue_reference.js";

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

/** Compact static-page state resolved from the deployment catalogue before hydration. */
export interface ExternalShellBootstrap {
  catalogue: ExternalCatalogueReference;
  context: BootstrapContext;
  view: BootstrapView;
}

/** Either a self-contained live bootstrap or a static shared-catalogue reference. */
export type ShellBootstrapState = ShellBootstrap | ExternalShellBootstrap;

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

/** Replace a static page's repeated catalogue with its deployment-owned reference. */
export function externalShellBootstrap(
  bootstrap: ShellBootstrap,
): ExternalShellBootstrap {
  return {
    ...bootstrap,
    catalogue: externalCatalogueReference(bootstrap.catalogue),
  };
}

/** Validate embedded JSON before it can select routes or delivery metadata. */
export function readShellBootstrap(value: unknown): ShellBootstrap {
  const state = readShellBootstrapState(value);
  if (isExternalShellBootstrap(state))
    throw new Error("External shell hydration requires a catalogue.");
  return state;
}

/** Validate either supported embedded bootstrap representation. */
export function readShellBootstrapState(value: unknown): ShellBootstrapState {
  if (!isRecord(value) || !isRecord(value.context) || !isRecord(value.view))
    throw new Error("Invalid shell hydration state.");
  const context = readContext(value.context);
  const view = readView(value.view);
  if (isExternalCatalogueReference(value.catalogue))
    return {
      catalogue: readExternalCatalogueReference(value.catalogue),
      context,
      view,
    };
  const catalogue = readCatalogue(value.catalogue);
  validateTarget(catalogue, view);
  return { catalogue, context, view };
}

/** Resolve a compact static bootstrap against its validated deployment catalogue. */
export function resolveShellBootstrap(
  state: ShellBootstrapState,
  catalogue: CatalogueReadModel,
): ShellBootstrap {
  if (!isExternalShellBootstrap(state)) return state;
  if (!catalogueReferenceMatches(state.catalogue, catalogue))
    throw new Error("The deployed catalogue does not match the page.");
  validateTarget(catalogue, state.view);
  return { catalogue, context: state.context, view: state.view };
}

/** Encode hydration state with stable lexical object-key ordering. */
export function serializeShellBootstrap(
  bootstrap: ShellBootstrapState,
): string {
  return canonicalJson(bootstrap).replaceAll("<", "\\u003c");
}

/** Recreate the exact component inputs used by standalone SSR. */
export function shellBootstrapProps(bootstrap: ShellBootstrap) {
  const catalogue = viewerCatalogue(bootstrap.catalogue);
  const selected =
    bootstrap.view.kind === "target"
      ? resolveCatalogueRoute(bootstrap.catalogue, bootstrap.view.route)
      : undefined;
  const selectedEntry = selected
    ? catalogueRouteEntry(catalogue, selected.entry.route)
    : undefined;
  const selectedId = selectedEntry?.id ?? null;
  const selection = {
    ...defaultSelection,
    screenId: selectedId,
    ...(selected?.snapshotId ? { snapshotId: selected.snapshotId } : {}),
  };
  const projected = viewerContext(bootstrap.catalogue, selection);
  const context: ShellContext = {
    ...projected,
    base: bootstrap.context.base,
    updateVersion: bootstrap.context.updateVersion,
    comparisons: bootstrap.context.comparisons,
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

function isExternalShellBootstrap(
  state: ShellBootstrapState,
): state is ExternalShellBootstrap {
  return isExternalCatalogueReference(state.catalogue);
}

function validateTarget(
  catalogue: CatalogueReadModel,
  view: BootstrapView,
): void {
  if (view.kind === "target" && !resolveCatalogueRoute(catalogue, view.route))
    throw new Error("Invalid shell hydration target.");
}

function targetView(
  catalogue: ReturnType<typeof viewerCatalogue>,
  route: string,
): ShellView {
  const entry = catalogueRouteEntry(catalogue, route);
  const target = entry && toRouteTarget(entry);
  if (!target) throw new Error("Invalid shell hydration target.");
  return { kind: "target", target };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}
