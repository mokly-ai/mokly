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
} from "./bootstrap.js";

/** A validated live bootstrap whose catalogue usage exactly matches its view. */
export type ScopedShellBootstrap =
  ShellBootstrapEnvelope<ShellCatalogueReadModel>;

/** Validate shell-only usage and enforce the scope derived from the route. */
export function readScopedShellBootstrap(value: unknown): ScopedShellBootstrap {
  const envelope = readShellBootstrapEnvelope(value);
  const catalogue = readShellCatalogue(envelope.catalogue);
  const scope = resolveCatalogueUsageScope(catalogue, envelope.view);
  for (const view of catalogueUsageViews(catalogue)) {
    const omitted = view.usage.status === "omitted";
    if (scope.has(view) && omitted)
      invalidData("$bootstrap", "in-scope usage cannot be omitted");
    if (!scope.has(view) && !omitted)
      invalidData("$bootstrap", "out-of-scope usage must be omitted");
  }
  return { ...envelope, catalogue };
}
