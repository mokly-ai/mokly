import { defineComponent, type ComponentProps } from "@mokly/mokly";

import { libraryMetadata } from "../metadata.js";
import { optionalFlag, previewViewport } from "../schemas.js";

import { ViewControlsView } from "./view-controls.view.js";

const propSchema = {
  kind: "object",
  properties: {
    selection: previewViewport,
    highlight: optionalFlag,
    unavailable: {
      schema: {
        kind: "enum",
        values: ["empty", "unavailable", "comparison", "removed"],
      },
      optional: true,
    },
  },
} as const;
export type ViewControlsProps = ComponentProps<typeof propSchema, []>;
const sample = { selection: "desktop" } as const;
export const viewControls = defineComponent({
  ...libraryMetadata(
    "controls",
    "view-controls",
    "View controls",
    "Viewport and component highlighting controls.",
  ),
  propSchema,
  controls: {
    selection: {
      kind: "select",
      label: "Viewport",
      options: previewViewport.schema.values.map((value) => ({
        label: value,
        value,
      })),
    },
    highlight: { kind: "boolean", label: "Highlight components" },
    unavailable: {
      kind: "select",
      label: "Unavailable reason",
      options: propSchema.properties.unavailable.schema.values.map((value) => ({
        label: value,
        value,
      })),
    },
  },
  render: ViewControlsView,
  variants: [
    { id: "default", title: "Default", props: sample },
    {
      id: "both",
      title: "Both viewports",
      props: { ...sample, selection: "both" },
    },
    {
      id: "highlighted",
      title: "Highlighted",
      props: { ...sample, highlight: true },
    },
    {
      id: "unavailable",
      title: "Unavailable",
      props: { ...sample, highlight: false, unavailable: "empty" },
    },
  ],
});
