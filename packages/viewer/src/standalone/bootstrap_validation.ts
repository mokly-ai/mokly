import { resolveCatalogueEntry } from "../catalogue/entry_selection.js";
import { readCatalogue } from "../catalogue/reader.js";
import { isHistoricalSnapshotId } from "../catalogue/snapshot_identity.js";
import type { CatalogueReadModel } from "../catalogue/types.js";
import { parseStaticDelivery } from "../navigation/delivery.js";
import { isEntryId, isLogicalFragment } from "../navigation/logical.js";
import type { EntryRouteKind } from "../navigation/routes.js";

import type {
  BootstrapContext,
  BootstrapView,
  ExternalShellBootstrap,
  ShellBootstrap,
  ShellBootstrapState,
} from "./bootstrap_types.js";
import {
  catalogueReferenceMatches,
  isExternalCatalogueReference,
  readExternalCatalogueReference,
} from "./catalogue_reference.js";

/** Validate embedded JSON that contains a complete catalogue. */
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

/** Resolve a compact static bootstrap against its deployment catalogue. */
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
  const theme = value["theme"];
  if (contentVersion !== undefined && !isVersion(contentVersion))
    throw new Error("Invalid shell content version.");
  if (previewGeneration !== undefined && typeof previewGeneration !== "string")
    throw new Error("Invalid shell preview generation.");
  if (fragment !== undefined && !isLogicalFragment(fragment))
    throw new Error("Invalid shell fragment.");
  if (
    theme !== undefined &&
    theme !== "auto" &&
    theme !== "dark" &&
    theme !== "light"
  )
    throw new Error("Invalid shell appearance.");
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
    ...(theme === undefined ? {} : { theme }),
  };
}

function readView(value: Record<string, unknown>): BootstrapView {
  if (value["kind"] === "home") return { kind: "home" };
  if (value["kind"] === "missing" && typeof value["requested"] === "string")
    return { kind: "missing", requested: value["requested"] };
  if (
    value["kind"] === "target" &&
    isEntryId(value["entryId"]) &&
    (value["snapshotId"] === undefined ||
      isHistoricalSnapshotId(value["snapshotId"])) &&
    ["component", "page", "screen", "use-case"].includes(
      String(value["entryKind"]),
    )
  )
    return {
      kind: "target",
      entryId: value["entryId"],
      entryKind: value["entryKind"] as EntryRouteKind,
      ...(value["snapshotId"] === undefined
        ? {}
        : { snapshotId: value["snapshotId"] }),
    };
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
  if (
    view.kind === "target" &&
    !resolveCatalogueEntry(
      catalogue,
      { id: view.entryId, kind: view.entryKind },
      view.snapshotId,
    )
  )
    throw new Error("Invalid shell hydration target.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}
