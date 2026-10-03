/** Serializable state shared by standalone shell SSR and browser hydration. */

import { resolveCatalogueEntry } from "../catalogue/entry_selection.js";
import type { ShellCatalogueReadModel } from "../catalogue/scoped_types.js";
import type { CatalogueReadModel } from "../catalogue/types.js";
import { canonicalJson } from "../components/data.js";
import type { StaticDelivery } from "../navigation/delivery.js";
import type { EntryRouteKind } from "../navigation/routes.js";
import {
  catalogueRouteEntry,
  catalogueSelectionEntry,
} from "../shell/catalogue.js";
import type { ShellContext } from "../shell/context.js";
import { toRouteTarget } from "../shell/target.js";
import type { ShellView } from "../shell/views.js";
import { viewerCatalogue, viewerContext } from "../viewer/projection.js";
import { defaultSelection } from "../viewer/selection.js";
import { normalizeTheme } from "../viewer/theme.js";

import type { ShellBootstrapEnvelope } from "./bootstrap_envelope.js";
import type {
  ExternalShellBootstrap,
  ShellBootstrap,
} from "./bootstrap_types.js";
import { externalCatalogueReference } from "./catalogue_reference.js";

export type { BootstrapView as ShellBootstrapView } from "./bootstrap_envelope.js";
export type {
  ExternalShellBootstrap,
  ShellBootstrap,
  ShellBootstrapState,
} from "./bootstrap_types.js";
export {
  readShellBootstrap,
  readShellBootstrapState,
  resolveShellBootstrap,
} from "./bootstrap_validation.js";

/** Build the browser-safe hydration state from an accepted server snapshot. */
export function shellBootstrap(
  catalogue: CatalogueReadModel,
  view: ShellView,
  context: ShellContext,
): ShellBootstrap {
  return {
    schemaVersion: 1,
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
        ? {
            kind: "target",
            entryId: view.target.entry.id,
            entryKind: view.target.entry.kind,
            ...(context.snapshotId === undefined
              ? {}
              : { snapshotId: context.snapshotId }),
          }
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
      ? resolveCatalogueEntry(
          bootstrap.catalogue,
          {
            id: bootstrap.view.entryId,
            kind: bootstrap.view.entryKind,
          },
          bootstrap.view.snapshotId,
        )
      : undefined;
  const selectedEntry = selected
    ? catalogueSelectionEntry(catalogue, selected.entry.id, selected.snapshotId)
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
      ? { activeId: bootstrap.view.entryId }
      : {}),
  };
  const view: ShellView =
    bootstrap.view.kind === "home"
      ? { kind: "home" }
      : bootstrap.view.kind === "missing"
        ? bootstrap.view
        : targetView(
            catalogue,
            bootstrap.view.entryId,
            bootstrap.view.entryKind,
            bootstrap.view.snapshotId,
          );
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

function targetView(
  catalogue: ReturnType<typeof viewerCatalogue>,
  id: string,
  kind: EntryRouteKind,
  snapshotId?: string,
): ShellView {
  const entry = snapshotId
    ? catalogueSelectionEntry(catalogue, id, snapshotId)
    : catalogueRouteEntry(catalogue, id, kind);
  if (entry?.kind !== kind) throw new Error("Invalid shell hydration target.");
  const target = entry && toRouteTarget(entry);
  if (!target) throw new Error("Invalid shell hydration target.");
  return { kind: "target", target };
}
