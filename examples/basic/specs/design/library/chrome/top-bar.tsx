import { defineComponent } from "@mokly/mokly";

import { DESTINATIONS } from "../../parts/destinations.js";
import { libraryTags } from "../controls/tag-picker.js";
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
const sample = {
  menu: "open",
  tags: libraryTags,
  pickerOpen: false,
  brandDestination: DESTINATIONS.home,
  menuDestination: DESTINATIONS.navigation,
  pickerDestination: DESTINATIONS.tagPicker,
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
      props: { ...sample, query: "tag:forms", activeTag: "forms" },
    },
    {
      slug: "tag-picker",
      title: "Tag picker",
      props: { ...sample, pickerOpen: true },
    },
    {
      slug: "drawer-open",
      title: "Drawer open",
      props: { ...sample, menu: "close", menuDestination: DESTINATIONS.home },
    },
    {
      slug: "auto-appearance",
      title: "Auto appearance",
      props: { ...sample, appearance: "auto" },
    },
  ],
});
