import { defineComponent, type ComponentProps } from "@mokly/mokly";

import { DESTINATIONS } from "../../parts/destinations.js";
import { libraryMetadata } from "../metadata.js";
import { destination, flag, text } from "../schemas.js";

import { TagChipView } from "./tag-chip.view.js";

const propSchema = {
  kind: "object",
  properties: { id: text, label: text, selected: flag, destination },
} as const;
export type TagChipProps = ComponentProps<typeof propSchema, []>;
export const tagChip = defineComponent({
  ...libraryMetadata(
    "controls",
    "tag-chip",
    "Tag chip",
    "An individual catalogue tag with optional selection and navigation.",
  ),
  propSchema,
  controls: {
    label: { kind: "text", label: "Label" },
    selected: { kind: "boolean", label: "Selected" },
  },
  render: TagChipView,
  variants: [
    {
      id: "design-ui-tag-chip-default",
      title: "Default",
      props: {
        id: "forms",
        label: "forms",
        selected: false,
        destination: DESTINATIONS.forms,
      },
    },
    {
      id: "design-ui-tag-chip-selected",
      title: "Selected",
      props: {
        id: "forms",
        label: "forms",
        selected: true,
        destination: DESTINATIONS.welcome,
      },
    },
    {
      id: "design-ui-tag-chip-inactive",
      title: "Inactive",
      props: { id: "onboarding", label: "onboarding", selected: false },
    },
  ],
});
