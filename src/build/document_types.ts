import type { ComponentViewRecord } from "@mokly/viewer";
import type { ArtifactView } from "@mokly/viewer/data";

import type { BuildDiagnostic } from "./build_warnings.js";
import type { LogicalReferenceRecord } from "./logical_record_types.js";
import type { ResourceSeed } from "./resource_seeds.js";

export interface CompiledDocument {
  diagnostics: readonly BuildDiagnostic[];
  route: string;
  html: string;
  view?: ComponentViewRecord;
  watchDocuments?: readonly (readonly [string, string])[];
  assetClosure?: readonly string[];
  resourceSeeds?: readonly ResourceSeed[];
}

export interface PreparedDocument extends CompiledDocument {
  records: readonly LogicalReferenceRecord[];
  anchors: ReadonlySet<string>;
}

export interface DocumentTarget extends ArtifactView {
  entryId: string;
}
