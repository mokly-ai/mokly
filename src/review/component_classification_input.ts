import type { Manifest } from "@mokly/viewer/data";

import type { ResolvedConfig } from "../config/types.js";

import type { ReviewAssetReader } from "./assets.js";
import type { CssRuleParser } from "./css/types.js";

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
  /** Test-only: disable the unchanged-view decision so both paths can be compared. */
  useFastPath?: boolean;
  /** Test-only: disable the style-only route without changing validation. */
  useStylePath?: boolean;
  /** Test-only: retain the delivered text-material oracle. */
  useMaterialFingerprints?: boolean;
}
