import { defineComponent } from "@mokly/mokly";

import { CANVAS_PAGES } from "../../canvas/parts/destinations.js";
import { libraryMetadata } from "../metadata.js";
import {
  destination,
  enumOptions,
  flag,
  text,
  type LibraryProps,
} from "../schemas.js";

import { FloatingPanelView } from "./floating-panel.view.js";
import { panelTabs } from "./panel-tabs.js";

const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["side", "label", "sheet"],
  properties: {
    side: { enum: ["left", "right"] },
    label: text,
    sheet: flag,
    closeDestination: destination,
  },
} as const;
const slots = ["head", "children", "foot"] as const;
export type FloatingPanelProps = LibraryProps<typeof propSchema, typeof slots>;

const catalogue = { side: "left", label: "Catalogue", sheet: false } as const;
const body = (
  <p className="cv-float-sample">
    The catalogue tree, or the selected entry&apos;s Inspect sections.
  </p>
);

export const floatingPanel = defineComponent({
  ...libraryMetadata(
    "panels",
    "floating-panel",
    "Floating panel",
    "A panel that floats over the canvas, and opens as a bottom sheet on a phone.",
  ),
  propSchema,
  props: catalogue,
  slots,
  controls: {
    label: { kind: "text", label: "Label" },
    side: {
      kind: "select",
      label: "Side",
      options: enumOptions(propSchema.properties.side),
    },
    sheet: { kind: "boolean", label: "Open as a sheet" },
  },
  render: FloatingPanelView,
  variants: [
    {
      slug: "catalogue",
      title: "Catalogue",
      props: catalogue,
      slots: { children: body },
    },
    {
      slug: "panel",
      title: "Right panel",
      props: { side: "right", label: "Panel", sheet: false },
      slots: {
        head: (
          <panelTabs.Component
            tabs={[
              {
                id: "inspect",
                label: "Inspect",
                destination: CANVAS_PAGES.overview,
              },
              { id: "changes", label: "Changes" },
            ]}
            selected="inspect"
          />
        ),
        children: body,
      },
    },
    {
      slug: "sheet",
      title: "Sheet",
      props: {
        side: "left",
        label: "Catalogue",
        sheet: true,
        closeDestination: CANVAS_PAGES.overview,
      },
      slots: { children: body },
    },
  ],
});
