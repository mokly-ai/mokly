/** Shared contracts for accepted catalogue Changes and background classification. */
import type {
  HistoricalManifest,
  ManifestV10,
  ReviewResultV7,
  ScreenResourceEvidence,
  PageResourceEvidence,
} from "@mokly/viewer/data";

import type { BaselineCatalogue } from "../baseline/catalogue.js";
import type { ResolvedConfig } from "../config/types.js";
import type { AcceptedGeneration } from "../review/accepted_generation.js";
import type { MovePairing } from "../review/moves/types.js";
import type { BaselineSelection } from "../review/repository.js";
import type { ReviewEvidence } from "../review/selection_types.js";

import type { CatalogueChangeClassification } from "./classification_result.js";
import type { ScreenViewChanges } from "./screen_view_changes.js";

export interface ComponentChangeSnapshot {
  baseline: HistoricalManifest;
  pairing?: MovePairing;
  changedEntries?: readonly string[];
  result?: ReviewResultV7;
  comparison?: ReviewEvidence;
  screenEvidence?: readonly ScreenResourceEvidence[];
  pageEvidence?: readonly PageResourceEvidence[];
  screenViews?: readonly ScreenViewChanges[];
}
export interface ComponentChangeSource {
  baseline(): Promise<string>;
  read(commit: string): Promise<ComponentChangeSnapshot | undefined>;
}

/** Background-owned inputs; a prepared commit prevents builds in disposable workers. */
export interface CatalogueClassificationInputs {
  readonly commit?: string;
  readonly selection?: BaselineSelection;
  readonly descriptor?: BaselineCatalogue;
  readonly generation?: AcceptedGeneration;
}

/** Read-only catalogue classification boundary used outside the HTTP child. */
export interface CatalogueChangeClassifier {
  read(
    config: ResolvedConfig,
    manifest: ManifestV10,
    base: string,
    signal?: AbortSignal,
    accepted?: CatalogueClassificationInputs,
  ): Promise<CatalogueChangeClassification>;
}
