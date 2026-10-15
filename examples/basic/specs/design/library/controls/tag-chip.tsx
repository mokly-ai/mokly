import { defineComponent } from "@mokly/mokly";

import { DESTINATIONS } from "../../parts/destinations.js";
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
/** Own props omit the destination, which the inactive chip does not have. */
const base = { id: "forms", label: "forms", selected: false } as const;
const sample = { ...base, destination: DESTINATIONS.forms } as const;
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
        destination: DESTINATIONS.welcome,
      },
    },
    {
      slug: "inactive",
      title: "Inactive",
      props: { id: "onboarding", label: "onboarding", selected: false },
    },
  ],
});
