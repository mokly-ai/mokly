import type { CatalogueReadModel } from "../../packages/viewer/src/generated/catalogue/CatalogueReadModel.js";
import type { EntryDetailV2 } from "../../packages/viewer/src/generated/catalogue/EntryDetailV2.js";
import type { ReviewResultV8 } from "../../packages/viewer/src/generated/catalogue/ReviewResultV8.js";

import type { BehaviourRecords } from "./behaviour-table.mjs";
import type { LegacyScenario } from "./legacy-adapter.mjs";

export interface RustScenario {
  catalogue?: CatalogueReadModel;
  details?: EntryDetailV2[];
  review?: ReviewResultV8;
  inventory?: LegacyScenario["inventory"];
  closures?: LegacyScenario["closures"];
}
export function adaptRustScenario(scenario: RustScenario): BehaviourRecords;
