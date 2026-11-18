import { DetailsBody } from "../../../../../../packages/ui/src/details-panel/details-panel.js";
import {
  MetadataCode,
  MetadataLink,
} from "../../../../../../packages/ui/src/metadata-row/metadata-row.js";
import { MetaRow } from "../../parts/metadata_row.js";

import { COMPONENTS, type ComponentEntryMetadata } from "./metadata.js";

/**
 * The shown entry's Details in the shipped body: its description, then its
 * path above its source, and its references, in the metadata column. A
 * stories entry links its story in the published Storybook directly below its
 * source, when the configuration gives that Storybook's URL.
 */
export function ComponentInfo({ entry }: { entry: ComponentEntryMetadata }) {
  const component = COMPONENTS[entry.component];
  const stories = "stories" in component;
  return (
    <DetailsBody description={component.description}>
      <MetaRow name="path" label="Path">
        <MetadataCode>{entry.path}</MetadataCode>
      </MetaRow>
      <MetaRow name="source" label="Source">
        <MetadataCode>{component.source}</MetadataCode>
      </MetaRow>
      {entry.storybook ? (
        <MetaRow name="storybook" label="Storybook">
          <MetadataLink href={entry.storybook}>Open in Storybook</MetadataLink>
        </MetaRow>
      ) : null}
      {entry.variantOf ? (
        <MetaRow name="variant-of" label="Variant of">
          {COMPONENTS[entry.variantOf].title}
        </MetaRow>
      ) : null}
      <MetaRow name="schemes" label="Schemes">
        Light, Dark
      </MetaRow>
      {stories ? null : (
        <>
          <MetaRow name="tags" label="Tags">
            Components
          </MetaRow>
          <MetaRow name="related-docs" label="Related docs">
            Component guide
          </MetaRow>
        </>
      )}
    </DetailsBody>
  );
}
