import type { CatalogueReadModel } from "../catalogue/types.js";
import type { StaticDelivery } from "../navigation/delivery.js";
import type { EntryRouteKind } from "../navigation/routes.js";
import type { ViewerTheme } from "../viewer/types.js";

import type { ExternalCatalogueReference } from "./catalogue_reference.js";

/** Route selection embedded in one standalone shell document. */
export type BootstrapView =
  | { kind: "home" }
  | { kind: "missing"; requested: string }
  | {
      kind: "target";
      entryId: string;
      entryKind: EntryRouteKind;
      snapshotId?: string;
    };

/** Browser-safe shell context embedded for standalone hydration. */
export interface BootstrapContext {
  base: string;
  updateVersion: number;
  contentVersion?: number;
  previewGeneration?: string;
  comparisons: boolean;
  delivery?: StaticDelivery;
  fragment?: string;
  theme?: ViewerTheme;
}

/** Public-catalogue state embedded in one server-rendered standalone page. */
export interface ShellBootstrap {
  catalogue: CatalogueReadModel;
  context: BootstrapContext;
  view: BootstrapView;
}

/** Compact static-page state that refers to the deployment catalogue. */
export interface ExternalShellBootstrap {
  catalogue: ExternalCatalogueReference;
  context: BootstrapContext;
  view: BootstrapView;
}

/** Either a self-contained live bootstrap or a static shared-catalogue reference. */
export type ShellBootstrapState = ShellBootstrap | ExternalShellBootstrap;
