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
}
