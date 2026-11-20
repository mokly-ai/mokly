import { defineComponent } from "@mokly/mokly";

import { CANVAS_PAGES } from "../../canvas/parts/destinations.js";
import { libraryMetadata } from "../metadata.js";
import { destination, enumOptions, type LibraryProps } from "../schemas.js";

import { PhoneDockView } from "./phone-dock.view.js";

const propSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    tab: { enum: ["inspect", "changes"] },
    zoom: { type: "integer", minimum: 1, maximum: 800 },
    catalogueDestination: destination,
    tabDestination: destination,
    fitDestination: destination,
  },
} as const;
export type PhoneDockProps = LibraryProps<typeof propSchema>;

/** Own props hold only the keys that every saved variant sets. */
const base = { catalogueDestination: CANVAS_PAGES.catalogue } as const;
const inspect = {
  ...base,
  tab: "inspect",
  zoom: 72,
  fitDestination: CANVAS_PAGES.overview,
} as const;

export const phoneDock = defineComponent({
  ...libraryMetadata(
    "panels",
    "phone-dock",
    "Phone dock",
    "The phone's floating dock: Catalogue, the right panel's current tab, and Fit.",
  ),
  propSchema,
  props: base,
  controls: {
    tab: {
      kind: "select",
      label: "Current tab",
      options: enumOptions(propSchema.properties.tab),
    },
  },
  render: PhoneDockView,
  variants: [
    { slug: "inspect", title: "Inspect", props: inspect },
    {
      slug: "home",
      title: "Nothing selected",
      props: base,
    },
  ],
});
