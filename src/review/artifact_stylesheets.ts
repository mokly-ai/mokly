import type { InsertedComponentStylesheet } from "@mokly/viewer";
import type { ReviewArtifact } from "@mokly/viewer/data";

/** Private final-document provenance; never serialized into comparison files. */
export interface StylesheetReviewArtifact extends ReviewArtifact {
  insertedStylesheets?: ReadonlyMap<
    string,
    readonly InsertedComponentStylesheet[]
  >;
}
