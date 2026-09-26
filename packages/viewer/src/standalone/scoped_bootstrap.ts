/** Strict reader for route-scoped live shell bootstraps. */

import { readShellCatalogue } from "../catalogue/reader.js";
import type { ShellCatalogueReadModel } from "../catalogue/scoped_types.js";
import {
  catalogueUsageViews,
  resolveCatalogueUsageScope,
} from "../catalogue/usage_scope.js";
import { invalidData } from "../components/data.js";

import {
  readShellBootstrapEnvelope,
  type ShellBootstrapEnvelope,
} from "./bootstrap_envelope.js";
import {
  isExternalCatalogueReference,
  readExternalCatalogueReference,
  type ExternalCatalogueReference,
} from "./catalogue_reference.js";

/** A validated live bootstrap whose catalogue usage exactly matches its view. */
export type ScopedShellBootstrap =
  ShellBootstrapEnvelope<ShellCatalogueReadModel>;
/** A validated live bootstrap whose usage is exactly scoped to its view. */
export type LiveShellBootstrap = ScopedShellBootstrap;
/** A live bootstrap or the unchanged compact static representation. */
export type LiveShellBootstrapState =
  LiveShellBootstrap | ShellBootstrapEnvelope<ExternalCatalogueReference>;

/** Validate shell-only usage and enforce the scope derived from the route. */
export function readScopedShellBootstrap(value: unknown): ScopedShellBootstrap {
  return readLiveShellBootstrap(value);
}

/** Validate one exactly route-scoped live page. */
export function readLiveShellBootstrap(value: unknown): LiveShellBootstrap {
  const envelope = readShellBootstrapEnvelope(value);
  if (isExternalCatalogueReference(envelope.catalogue))
    throw new Error("External shell hydration requires a catalogue.");
  return readLiveEnvelope(envelope);
}

/** Validate a scoped live page or the unchanged static external reference. */
export function readLiveShellBootstrapState(
  value: unknown,
): LiveShellBootstrapState {
  const envelope = readShellBootstrapEnvelope(value);
  if (isExternalCatalogueReference(envelope.catalogue))
    return {
      ...envelope,
      catalogue: readExternalCatalogueReference(envelope.catalogue),
    };
  return readLiveEnvelope(envelope);
}

function readLiveEnvelope(
  envelope: ShellBootstrapEnvelope<unknown>,
): LiveShellBootstrap {
  const catalogue = readShellCatalogue(envelope.catalogue);
  enforceExactScope(catalogue, envelope.view);
  return { ...envelope, catalogue };
}

function enforceExactScope(
  catalogue: ShellCatalogueReadModel,
  view: LiveShellBootstrap["view"],
): void {
  const scope = resolveCatalogueUsageScope(catalogue, view);
  for (const view of catalogueUsageViews(catalogue)) {
    const omitted = view.usage.status === "omitted";
    if (scope.has(view) && omitted)
      invalidData("$bootstrap", "in-scope usage cannot be omitted");
    if (!scope.has(view) && !omitted)
      invalidData("$bootstrap", "out-of-scope usage must be omitted");
  }
}
