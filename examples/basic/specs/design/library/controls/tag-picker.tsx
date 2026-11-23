import { defineComponent } from "@mokly/mokly";

import { CANVAS_PAGES } from "../../canvas/parts/destinations.js";
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

/**
 * The catalogue's tags while no tag is entered: a chip enters its tag and
 * closes the picker, so it opens the Canvas artboard of its filter.
 */
export const libraryTags = [
  { id: "forms", label: "forms", destination: CANVAS_PAGES.tagForms },
  {
    id: "onboarding",
    label: "onboarding",
    destination: CANVAS_PAGES.tagOnboarding,
  },
] as const;

/**
 * The same tags with forms entered: the entered tag's chip clears the query,
 * so it opens the overview.
 */
export const formsEnteredTags = [
  { id: "forms", label: "forms", destination: CANVAS_PAGES.overview },
  libraryTags[1],
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
      props: { tags: formsEnteredTags, activeTag: "forms", open: true },
    },
    {
      slug: "empty",
      title: "No tags",
      props: { tags: [], open: true },
    },
  ],
});
