import { defineComponent } from "@mokly/mokly";

import { CANVAS_PAGES } from "../../canvas/parts/destinations.js";
import { formsEnteredTags, libraryTags } from "../controls/tag-picker.js";
import { libraryMetadata } from "../metadata.js";
import {
  destination,
  enumOptions,
  flag,
  tagRecords,
  text,
  type LibraryProps,
} from "../schemas.js";

import { TopBarView } from "./top-bar.view.js";

const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["menu", "tags", "pickerOpen"],
  properties: {
    query: text,
    viewport: { enum: ["mobile", "desktop"] },
    menu: { enum: ["none", "open", "close"] },
    tags: tagRecords,
    activeTag: text,
    appearance: { enum: ["auto", "light", "dark"] },
    pickerOpen: flag,
    appearanceChanged: flag,
    brandDestination: destination,
    menuDestination: destination,
    pickerDestination: destination,
  },
} as const;
export type TopBarProps = LibraryProps<typeof propSchema>;

/**
 * The bar over the Canvas overview, which opens the artboards that the
 * Canvas top bar opens: the brand the home, the menu the catalogue sheet,
 * and the tag button the open picker.
 */
const sample = {
  menu: "open",
  tags: libraryTags,
  pickerOpen: false,
  brandDestination: CANVAS_PAGES.home,
  menuDestination: CANVAS_PAGES.catalogue,
  pickerDestination: CANVAS_PAGES.tagPicker,
} as const;
export const topBar = defineComponent({
  ...libraryMetadata(
    "chrome",
    "top-bar",
    "Top bar",
    "Branding, search, catalogue navigation, tag filtering and appearance.",
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
    menu: {
      kind: "select",
      label: "Menu",
      options: enumOptions(propSchema.properties.menu),
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
      slug: "drawer-open",
      title: "Drawer open",
      props: {
        ...sample,
        menu: "close",
        menuDestination: CANVAS_PAGES.overview,
      },
    },
    {
      slug: "auto-appearance",
      title: "Auto appearance",
      props: { ...sample, appearance: "auto" },
    },
  ],
});
