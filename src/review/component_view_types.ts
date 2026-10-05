import type { ComponentViewRecord } from "@mokly/viewer";
import type {
  EntryChangeReason,
  ViewReview,
  DependencyReason,
} from "@mokly/viewer/data";

import type { OwnedResourceReason } from "./component_resource_attribution.js";
import type { ComponentMaterialReader } from "./component_resources.js";
import type { ReviewLinkNormalization } from "./ignore.js";
import type { MoveResources } from "./moves/resources.js";
import type { ResourceComparison } from "./resource_comparison.js";

export interface ComparedComponentView {
  comparisonPath: "fast" | "complete";
  view: ViewReview;
  reasons: readonly EntryChangeReason[];
  changedImplementations: ReadonlySet<string>;
  ownedResources: readonly OwnedResourceReason[];
  componentCssReasons?: readonly DependencyReason[];
}
export interface ComponentViewContext {
  resourceIdentity?: MoveResources;
  beforeReader: ComponentMaterialReader;
  afterReader: ComponentMaterialReader;
  changed: ReadonlySet<string>;
  prefix: string;
  resources: ResourceComparison;
  compareResourceBytes?: boolean;
  useFastPath?: boolean;
  links?: (beforeRoute: string, afterRoute: string) => ReviewLinkNormalization;
  beforeUsage?: (usage: ComponentViewRecord) => ComponentViewRecord;
}
