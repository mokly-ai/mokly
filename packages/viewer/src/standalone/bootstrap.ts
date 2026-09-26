/** Serializable state shared by standalone shell SSR and browser hydration. */

import { resolveCatalogueRoute } from "../catalogue/entry_selection.js";
import { readCatalogue } from "../catalogue/reader.js";
import type { ShellCatalogueReadModel } from "../catalogue/scoped_types.js";
import type { CatalogueReadModel } from "../catalogue/types.js";
import { canonicalJson } from "../components/data.js";
import type { StaticDelivery } from "../navigation/delivery.js";
import { catalogueRouteEntry } from "../shell/catalogue.js";
import type { ShellContext } from "../shell/context.js";
import { toRouteTarget } from "../shell/target.js";
import type { ShellView } from "../shell/views.js";
import { viewerCatalogue, viewerContext } from "../viewer/projection.js";
import { defaultSelection } from "../viewer/selection.js";
import { normalizeTheme } from "../viewer/theme.js";

import {
  readShellBootstrapEnvelope,
  type ShellBootstrapEnvelope,
  type ShellBootstrapView,
} from "./bootstrap_envelope.js";
import {
  catalogueReferenceMatches,
  externalCatalogueReference,
  isExternalCatalogueReference,
  readExternalCatalogueReference,
  type ExternalCatalogueReference,
} from "./catalogue_reference.js";

export { readShellBootstrapEnvelope } from "./bootstrap_envelope.js";
export type {
  ShellBootstrapContext,
  ShellBootstrapEnvelope,
  ShellBootstrapView,
} from "./bootstrap_envelope.js";

/** Public-catalogue state embedded in one server-rendered standalone page. */
export type ShellBootstrap = ShellBootstrapEnvelope<CatalogueReadModel>;

/** Compact static-page state resolved from the deployment catalogue before hydration. */
export type ExternalShellBootstrap =
  ShellBootstrapEnvelope<ExternalCatalogueReference>;

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
      ...(context.theme === undefined
        ? {}
        : { theme: normalizeTheme(context.theme) }),
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
  const envelope = readShellBootstrapEnvelope(value);
  if (isExternalCatalogueReference(envelope.catalogue))
    return {
      catalogue: readExternalCatalogueReference(envelope.catalogue),
      context: envelope.context,
      view: envelope.view,
    };
  const catalogue = readCatalogue(envelope.catalogue);
  validateTarget(catalogue, envelope.view);
  return { ...envelope, catalogue };
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
  bootstrap: ShellBootstrapEnvelope<unknown>,
): string {
  return canonicalJson(bootstrap).replaceAll("<", "\\u003c");
}

/** Recreate the exact component inputs used by standalone SSR. */
export function shellBootstrapProps(
  bootstrap: ShellBootstrapEnvelope<ShellCatalogueReadModel>,
) {
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
    embedded: false,
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
    ...(bootstrap.context.theme === undefined
      ? {}
      : { theme: bootstrap.context.theme }),
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
export function shellBootstrapWithDelivery<
  Catalogue extends ShellCatalogueReadModel,
>(
  bootstrap: ShellBootstrapEnvelope<Catalogue>,
  delivery: StaticDelivery,
): ShellBootstrapEnvelope<Catalogue> {
  return {
    ...bootstrap,
    catalogue: {
      ...bootstrap.catalogue,
      deploymentId: delivery.deploymentId,
    } as Catalogue,
    context: { ...bootstrap.context, delivery },
  };
}

function isExternalShellBootstrap(
  state: ShellBootstrapState,
): state is ExternalShellBootstrap {
  return isExternalCatalogueReference(state.catalogue);
}

function validateTarget(
  catalogue: CatalogueReadModel,
  view: ShellBootstrapView,
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
