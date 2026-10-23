import { defineComponent } from "@mokly/mokly";

import { DESTINATIONS } from "../../parts/destinations.js";
import { libraryMetadata } from "../metadata.js";
import { tagRecords, text, type LibraryProps } from "../schemas.js";

import { TagPickerView } from "./tag-picker.view.js";

const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["tags"],
  properties: { tags: tagRecords, activeTag: text },
} as const;
export type TagPickerProps = LibraryProps<typeof propSchema>;
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
  props: { tags: libraryTags },
  controls: { activeTag: { kind: "text", label: "Active tag" } },
  render: TagPickerView,
  variants: [
    {
      slug: "all",
      title: "All tags",
      props: { tags: libraryTags },
    },
    {
      slug: "selected",
      title: "Selected tag",
      props: { tags: libraryTags, activeTag: "forms" },
    },
    {
      slug: "empty",
      title: "No tags",
      props: { tags: [] },
    },
  ],
});
