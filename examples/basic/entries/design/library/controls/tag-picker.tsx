import { defineComponent, type ComponentProps } from "@mokly/mokly";

import { DESTINATIONS } from "../../parts/destinations.js";
import { libraryMetadata } from "../metadata.js";
import { optionalText, tagRecords } from "../schemas.js";

import { TagPickerView } from "./tag-picker.view.js";

const propSchema = {
  kind: "object",
  properties: { tags: tagRecords, activeTag: optionalText },
} as const;
export type TagPickerProps = ComponentProps<typeof propSchema, []>;
export const libraryTags = [
  { id: "forms", label: "forms", destination: DESTINATIONS.forms },
  {
    id: "onboarding",
    label: "onboarding",
    destination: DESTINATIONS.onboarding,
  },
] as const;
export const tagPicker = defineComponent({
  ...libraryMetadata(
    "controls",
    "tag-picker",
    "Tag picker",
    "Catalogue tags and the active selection.",
  ),
  propSchema,
  controls: { activeTag: { kind: "text", label: "Active tag" } },
  render: TagPickerView,
  variants: [
    {
      id: "design-ui-tag-picker-all",
      title: "All tags",
      props: { tags: libraryTags },
    },
    {
      id: "design-ui-tag-picker-selected",
      title: "Selected tag",
      props: { tags: libraryTags, activeTag: "forms" },
    },
    {
      id: "design-ui-tag-picker-empty",
      title: "No tags",
      props: { tags: [] },
    },
  ],
});
