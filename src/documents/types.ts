import type { EntryInput } from "../authoring/types.js";

/** Internal file-defined entry. Documents have no public authoring helper or brand. */
export interface DocumentDefinition extends EntryInput {
  kind: "document";
  tags?: readonly string[];
  resources: readonly string[];
  body: string;
}
