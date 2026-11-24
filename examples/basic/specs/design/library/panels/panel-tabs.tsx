import { defineComponent } from "@mokly/mokly";

import { CANVAS_PAGES } from "../../canvas/parts/destinations.js";
import { libraryMetadata } from "../metadata.js";
import {
  destination,
  enumOptions,
  text,
  type LibraryProps,
} from "../schemas.js";

import { PanelTabsView } from "./panel-tabs.view.js";

const tab = { enum: ["inspect", "changes"] } as const;
const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["tabs", "selected"],
  properties: {
    tabs: {
      type: "array",
      minItems: 1,
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label"],
        properties: { id: tab, label: text, destination },
      },
    },
    selected: tab,
  },
} as const;
export type PanelTabsProps = LibraryProps<typeof propSchema>;

const both = {
  tabs: [
    { id: "inspect", label: "Inspect", destination: CANVAS_PAGES.overview },
    { id: "changes", label: "Changes" },
  ],
  selected: "inspect",
} as const;

export const panelTabs = defineComponent({
  ...libraryMetadata(
    "panels",
    "panel-tabs",
    "Panel tabs",
    "The right panel's text tabs: Inspect, and Changes on a changed entry.",
  ),
  propSchema,
  props: both,
  controls: {
    selected: {
      kind: "select",
      label: "Selected tab",
      options: enumOptions(tab),
    },
  },
  render: PanelTabsView,
  variants: [
    { slug: "changed", title: "Changed entry", props: both },
    {
      slug: "unchanged",
      title: "Unchanged entry",
      props: {
        tabs: [
          {
            id: "inspect",
            label: "Inspect",
            destination: CANVAS_PAGES.unchanged,
          },
        ],
        selected: "inspect",
      },
    },
  ],
});
