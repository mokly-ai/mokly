import { defineComponent, mockLink } from "@mokly/mokly";

import {
  MetadataChips,
  MetadataLink,
} from "../../../../../../packages/ui/src/metadata-row/metadata-row.js";
import { CANVAS_PAGES } from "../../canvas/parts/destinations.js";
import { tagChip } from "../controls/tag-chip.js";
import { libraryMetadata } from "../metadata.js";
import { text, type LibraryProps } from "../schemas.js";

import { MetadataRowView } from "./metadata-row.view.js";

const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["label", "presentation"],
  properties: {
    label: text,
    presentation: { enum: ["metadata", "props"] },
  },
} as const;
const slots = ["children"] as const;
export type MetadataRowProps = LibraryProps<typeof propSchema, typeof slots>;
export const metadataRow = defineComponent({
  ...libraryMetadata(
    "inspector",
    "metadata-row",
    "Metadata row",
    "A labelled value in the details or props panel.",
  ),
  propSchema,
  props: { label: "Schemes", presentation: "metadata" },
  slots,
  controls: { label: { kind: "text", label: "Label" } },
  render: MetadataRowView,
  variants: [
    {
      slug: "text",
      title: "Text",
      props: { label: "Schemes", presentation: "metadata" },
      slots: { children: "Light, Dark" },
    },
    {
      slug: "code",
      title: "Code",
      props: { label: "label", presentation: "props" },
      slots: { children: <code>Continue</code> },
    },
    {
      // A related document opens its reading frame, as Inspect's Related
      // docs row does in the Canvas artboards.
      slug: "linked",
      title: "Linked",
      props: { label: "Related docs", presentation: "metadata" },
      slots: {
        children: (
          <MetadataChips>
            <MetadataLink href={mockLink(CANVAS_PAGES.document)}>
              Payment terms
            </MetadataLink>
          </MetadataChips>
        ),
      },
    },
    {
      slug: "tags",
      title: "Tags",
      props: { label: "Tags", presentation: "metadata" },
      slots: {
        children: (
          <MetadataChips>
            <tagChip.Component id="forms" label="forms" selected={false} />
          </MetadataChips>
        ),
      },
    },
  ],
});
