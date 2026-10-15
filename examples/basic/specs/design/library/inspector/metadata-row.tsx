import { defineComponent, MockLink } from "@mokly/mokly";

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
      slug: "linked",
      title: "Linked",
      props: { label: "Used by", presentation: "metadata" },
      slots: {
        children: (
          <MockLink to="design/browse/views/use-case">Example tour</MockLink>
        ),
      },
    },
    {
      slug: "tags",
      title: "Tags",
      props: { label: "Tags", presentation: "metadata" },
      slots: {
        children: (
          <span className="mbk-chips">
            <tagChip.Component id="forms" label="forms" selected={false} />
          </span>
        ),
      },
    },
  ],
});
