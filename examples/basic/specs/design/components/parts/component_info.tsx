import { DetailsBody } from "../../../../../../packages/ui/src/details-panel/details-panel.js";
import { MetadataCode } from "../../../../../../packages/ui/src/metadata-row/metadata-row.js";
import { MetaRow } from "../../parts/metadata_row.js";

import { COMPONENTS, type ComponentEntryMetadata } from "./metadata.js";

/**
 * The shown entry's Details in the shipped body: its description, then its
 * path above its source, and its references, in the metadata column.
 */
export function ComponentInfo({ entry }: { entry: ComponentEntryMetadata }) {
  const component = COMPONENTS[entry.component];
  return (
    <DetailsBody description={component.description}>
      <MetaRow name="path" label="Path">
        <MetadataCode>{entry.path}</MetadataCode>
      </MetaRow>
      <MetaRow name="source" label="Source">
        <MetadataCode>{component.source}</MetadataCode>
      </MetaRow>
      {entry.variantOf ? (
        <MetaRow name="variant-of" label="Variant of">
          {COMPONENTS[entry.variantOf].title}
        </MetaRow>
      ) : null}
      <MetaRow name="schemes" label="Schemes">
        Light, Dark
      </MetaRow>
      <MetaRow name="tags" label="Tags">
        Components
      </MetaRow>
      <MetaRow name="related-docs" label="Related docs">
        Component guide
      </MetaRow>
    </DetailsBody>
  );
}
