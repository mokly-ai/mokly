/** Strict reader for route-scoped live shell bootstraps. */

import { resolveCatalogueRoute } from "../catalogue/entry_selection.js";
import { readShellCatalogue } from "../catalogue/reader.js";
import type { ShellCatalogueReadModel } from "../catalogue/scoped_types.js";
import {
  catalogueHasOmittedUsage,
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
/** A validated live bootstrap accepted during the complete-to-scoped rollout. */
export type LiveShellBootstrap = ScopedShellBootstrap;
/** Whether live pages may still carry complete usage during staged rollout. */
export type LiveShellBootstrapMode = "scoped" | "transitional";
/** Current staged live-reader policy; Milestone 6 switches this with emission. */
export const LIVE_SHELL_BOOTSTRAP_MODE: LiveShellBootstrapMode = "transitional";
/** A live bootstrap or the unchanged compact static representation. */
export type LiveShellBootstrapState =
  LiveShellBootstrap | ShellBootstrapEnvelope<ExternalCatalogueReference>;

/** Validate shell-only usage and enforce the scope derived from the route. */
export function readScopedShellBootstrap(value: unknown): ScopedShellBootstrap {
  return readLiveShellBootstrap(value, "scoped");
}

/** Read one live page under an explicit rollout mode. */
export function readLiveShellBootstrap(
  value: unknown,
  mode: LiveShellBootstrapMode,
): LiveShellBootstrap {
  const envelope = readShellBootstrapEnvelope(value);
  if (isExternalCatalogueReference(envelope.catalogue))
    throw new Error("External shell hydration requires a catalogue.");
  return readLiveEnvelope(envelope, mode);
}

/** Read live state transitionally while preserving static external validation. */
export function readLiveShellBootstrapState(
  value: unknown,
  mode: LiveShellBootstrapMode,
): LiveShellBootstrapState {
  const envelope = readShellBootstrapEnvelope(value);
  if (isExternalCatalogueReference(envelope.catalogue))
    return {
      ...envelope,
      catalogue: readExternalCatalogueReference(envelope.catalogue),
    };
  return readLiveEnvelope(envelope, mode);
}

function readLiveEnvelope(
  envelope: ShellBootstrapEnvelope<unknown>,
  mode: LiveShellBootstrapMode,
): LiveShellBootstrap {
  const catalogue = readShellCatalogue(envelope.catalogue);
  if (mode === "transitional" && !catalogueHasOmittedUsage(catalogue)) {
    if (
      envelope.view.kind === "target" &&
      !resolveCatalogueRoute(catalogue, envelope.view.route)
    )
      invalidData("$bootstrap", "invalid shell hydration target");
    return { ...envelope, catalogue };
  }
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
