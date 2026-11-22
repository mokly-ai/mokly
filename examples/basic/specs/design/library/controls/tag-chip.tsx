import { defineComponent } from "@mokly/mokly";

import { CANVAS_PAGES } from "../../canvas/parts/destinations.js";
import { libraryMetadata } from "../metadata.js";
import { destination, flag, text, type LibraryProps } from "../schemas.js";

import { TagChipView } from "./tag-chip.view.js";

const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "label", "selected"],
  properties: { id: text, label: text, selected: flag, destination },
} as const;
export type TagChipProps = LibraryProps<typeof propSchema>;
/**
 * Own props omit the destination, which the inactive chip does not have. A
 * chip opens the Canvas artboard of its filter, and the chip of the entered
 * tag opens the overview, where the query is cleared.
 */
const base = { id: "forms", label: "forms", selected: false } as const;
const sample = { ...base, destination: CANVAS_PAGES.tagForms } as const;
export const tagChip = defineComponent({
  ...libraryMetadata(
    "controls",
    "tag-chip",
    "Tag chip",
    "An individual catalogue tag with optional selection and navigation.",
  ),
  propSchema,
  props: base,
  controls: {
    label: { kind: "text", label: "Label" },
    selected: { kind: "boolean", label: "Selected" },
  },
  render: TagChipView,
  variants: [
    {
      slug: "default",
      title: "Default",
      props: sample,
    },
    {
      slug: "selected",
      title: "Selected",
      props: {
        id: "forms",
        label: "forms",
        selected: true,
        destination: CANVAS_PAGES.overview,
      },
    },
    {
      slug: "inactive",
      title: "Inactive",
      props: { id: "onboarding", label: "onboarding", selected: false },
    },
  ],
});
