import type { ComponentViewRecord } from "@mokly/viewer";
import type { ArtifactView } from "@mokly/viewer/data";

import type { LogicalReferenceRecord } from "./logical_record_types.js";
import type { BuildWarning } from "./warnings.js";

export interface CompiledDocument {
  route: string;
  html: string;
  view?: ComponentViewRecord;
  watchDocuments?: readonly (readonly [string, string])[];
  warnings?: readonly BuildWarning[];
}

export interface PreparedDocument extends CompiledDocument {
  records: readonly LogicalReferenceRecord[];
  anchors: ReadonlySet<string>;
}

export interface DocumentTarget extends ArtifactView {
  entryId: string;
}
