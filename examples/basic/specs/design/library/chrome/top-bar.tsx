import { defineComponent } from "@mokly/mokly";

import { CANVAS_PAGES } from "../../canvas/parts/destinations.js";
import { formsEnteredTags, libraryTags } from "../controls/tag-picker.js";
import { libraryMetadata } from "../metadata.js";
import {
  destination,
  flag,
  tagRecords,
  text,
  type LibraryProps,
} from "../schemas.js";

import { TopBarView } from "./top-bar.view.js";

const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["tags", "pickerOpen"],
  properties: {
    query: text,
    viewport: { enum: ["mobile", "desktop"] },
    tags: tagRecords,
    activeTag: text,
    appearance: { enum: ["auto", "light", "dark"] },
    pickerOpen: flag,
    appearanceChanged: flag,
    brandDestination: destination,
    pickerDestination: destination,
  },
} as const;
export type TopBarProps = LibraryProps<typeof propSchema>;

/**
 * The bar over the Canvas overview, which opens the artboards that the
 * Canvas top bar opens: the brand the home, and the tag button the open
 * picker. The bar has no menu: the dock's Catalogue opens the catalogue
 * sheet.
 */
const sample = {
  tags: libraryTags,
  pickerOpen: false,
  brandDestination: CANVAS_PAGES.home,
  pickerDestination: CANVAS_PAGES.tagPicker,
} as const;
export const topBar = defineComponent({
  ...libraryMetadata(
    "chrome",
    "top-bar",
    "Top bar",
    "Branding, search, tag filtering and appearance.",
  ),
  propSchema,
  props: sample,
  controls: {
    query: { kind: "text", label: "Query" },
    pickerOpen: { kind: "boolean", label: "Tag picker open" },
    appearance: {
      kind: "select",
      label: "Appearance selector",
      options: [
        { label: "auto", value: "auto" },
        { label: "light", value: "light" },
        { label: "dark", value: "dark" },
      ],
    },
  },
  render: (props, context) => (
    <TopBarView
      {...props}
      appearance={props.appearance ?? context.colorScheme}
      viewport={props.viewport ?? context.viewport}
    />
  ),
  variants: [
    { slug: "default", title: "Default", props: sample },
    {
      slug: "search",
      title: "Search",
      props: {
        ...sample,
        query: "tag:forms",
        activeTag: "forms",
        tags: formsEnteredTags,
        pickerDestination: CANVAS_PAGES.tagFormsPicker,
      },
    },
    {
      slug: "tag-picker",
      title: "Tag picker",
      props: {
        ...sample,
        pickerOpen: true,
        pickerDestination: CANVAS_PAGES.overview,
      },
    },
    {
      slug: "auto-appearance",
      title: "Auto appearance",
      props: { ...sample, appearance: "auto" },
    },
  ],
});
