import type { Manifest } from "@mokly/viewer/data";

import type { ResolvedConfig } from "../config/types.js";

import type { ReviewAssetReader } from "./assets.js";
import type { CssResourceAnalysis } from "./css/resource_analysis.js";
import type { CssRuleParser } from "./css/types.js";
import type { BaselineReader } from "./git.js";
import type { MarkdownMoveSources } from "./moves/markdown_sources.js";
import type { MoveResources } from "./moves/resources.js";
import type { MovePairing } from "./moves/types.js";

export interface ComponentClassificationInput {
  before: Manifest;
  after: Manifest;
  beforeReader: ReviewAssetReader;
  afterReader: ReviewAssetReader;
  config: ResolvedConfig;
  changedPaths: readonly string[];
  baseCommit: string;
  baseRef: string;
  cssParser?: CssRuleParser;
  /** Test-only: vary each independent CSS cache bound without changing classification. */
  cssCacheBytes?: number;
  cssAnalysis?: CssResourceAnalysis;
  /** Test-only: disable the unchanged-view decision so both paths can be compared. */
  useFastPath?: boolean;
  /** Test-only: disable the style-only route without changing validation. */
  useStylePath?: boolean;
  /** Test-only: retain the delivered text-material oracle. */
  useMaterialFingerprints?: boolean;
  /** Reuse the generation's pairing instead of computing another candidate pass. */
  pairing?: MovePairing;
  markdown?: MarkdownMoveSources;
  resources?: MoveResources;
  sourceReader?: BaselineReader;
}
