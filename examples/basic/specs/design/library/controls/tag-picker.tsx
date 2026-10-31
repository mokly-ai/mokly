import { defineComponent } from "@mokly/mokly";

import { DESTINATIONS } from "../../parts/destinations.js";
import { libraryMetadata } from "../metadata.js";
import {
  destination,
  flag,
  tagRecords,
  text,
  type LibraryProps,
} from "../schemas.js";

import { TagPickerView } from "./tag-picker.view.js";

const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["tags", "open"],
  properties: {
    tags: tagRecords,
    activeTag: text,
    open: flag,
    toggleDestination: destination,
  },
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
  props: { tags: libraryTags, open: true },
  controls: { activeTag: { kind: "text", label: "Active tag" } },
  render: TagPickerView,
  variants: [
    {
      slug: "all",
      title: "All tags",
      props: { tags: libraryTags, open: true },
    },
    {
      slug: "selected",
      title: "Selected tag",
      props: { tags: libraryTags, activeTag: "forms", open: true },
    },
    {
      slug: "empty",
      title: "No tags",
      props: { tags: [], open: true },
    },
  ],
});
