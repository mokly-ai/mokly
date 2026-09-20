import {
  defineComponent,
  type ComponentProps,
  type ComponentRenderContext,
} from "@mokly/mokly";

import { DESTINATIONS } from "../../parts/destinations.js";
import { libraryTags } from "../controls/tag-picker.js";
import { libraryMetadata } from "../metadata.js";
import {
  destination,
  flag,
  optionalText,
  tagRecords,
  text,
} from "../schemas.js";

import { TopBarView } from "./top-bar.view.js";

const propSchema = {
  kind: "object",
  properties: {
    query: optionalText,
    placeholder: text,
    viewport: {
      schema: { kind: "enum", values: ["mobile", "desktop"] },
      optional: true,
    },
    menu: { schema: { kind: "enum", values: ["none", "open", "close"] } },
    menuPresentation: { schema: { kind: "enum", values: ["text", "icon"] } },
    tags: tagRecords,
    activeTag: optionalText,
    appearance: {
      schema: { kind: "enum", values: ["auto", "light", "dark"] },
      optional: true,
    },
    pickerOpen: flag,
    brandDestination: destination,
    menuDestination: destination,
    pickerDestination: destination,
  },
} as const;
export type TopBarProps = ComponentProps<typeof propSchema, []>;
const sample = {
  placeholder: "Search screens…",
  menu: "open",
  menuPresentation: "text",
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
      options: propSchema.properties.menu.schema.values.map((value) => ({
        label: value,
        value,
      })),
    },
  },
  render: (props: TopBarProps, context: ComponentRenderContext) => (
    <TopBarView
      {...props}
      appearance={props.appearance ?? context.colorScheme}
      viewport={props.viewport ?? context.viewport}
    />
  ),
  variants: [
    { id: "default", title: "Default", props: sample },
    {
      id: "search",
      title: "Search",
      props: { ...sample, query: "tag:forms", activeTag: "forms" },
    },
    {
      id: "tag-picker",
      title: "Tag picker",
      props: { ...sample, pickerOpen: true },
    },
    {
      id: "drawer-open",
      title: "Drawer open",
      props: { ...sample, menu: "close", menuDestination: DESTINATIONS.home },
    },
    {
      id: "auto-appearance",
      title: "Auto appearance",
      props: { ...sample, appearance: "auto" },
    },
  ],
});
