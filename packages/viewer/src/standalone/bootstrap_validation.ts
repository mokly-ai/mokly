import { resolveCatalogueEntry } from "../catalogue/entry_selection.js";
import { readCatalogue } from "../catalogue/reader.js";
import type { CatalogueReadModel } from "../catalogue/types.js";

import { readShellBootstrapEnvelope } from "./bootstrap_envelope.js";
import type {
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
  const envelope = readShellBootstrapEnvelope(value);
  if (isExternalCatalogueReference(envelope.catalogue))
    return {
      ...envelope,
      catalogue: readExternalCatalogueReference(envelope.catalogue),
    };
  const catalogue = readCatalogue(envelope.catalogue);
  validateTarget(catalogue, envelope.view);
  return { ...envelope, catalogue };
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
  return {
    schemaVersion: 2,
    catalogue,
    context: state.context,
    view: state.view,
  };
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
      { path: view.entryPath, kind: view.entryKind },
      view.snapshotId,
    )
  )
    throw new Error("Invalid shell hydration target.");
}
