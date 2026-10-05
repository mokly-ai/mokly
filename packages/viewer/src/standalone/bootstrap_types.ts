import type { ShellCatalogueReadModel } from "../catalogue/scoped_types.js";
import type { CatalogueReadModel } from "../catalogue/types.js";

import type { ShellBootstrapEnvelope } from "./bootstrap_envelope.js";
import type { ExternalCatalogueReference } from "./catalogue_reference.js";

export type { BootstrapContext, BootstrapView } from "./bootstrap_envelope.js";

/** Public-catalogue state embedded in one server-rendered standalone page. */
export type ShellBootstrap = ShellBootstrapEnvelope<CatalogueReadModel>;

/** Route-scoped state embedded in one live standalone page. */
export type LiveShellBootstrap =
  ShellBootstrapEnvelope<ShellCatalogueReadModel>;

/** Compact static-page state that refers to the deployment catalogue. */
export type ExternalShellBootstrap =
  ShellBootstrapEnvelope<ExternalCatalogueReference>;

/** Either a self-contained live bootstrap or a static shared-catalogue reference. */
export type ShellBootstrapState = ShellBootstrap | ExternalShellBootstrap;
