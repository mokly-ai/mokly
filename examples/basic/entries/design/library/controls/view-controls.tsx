import { defineComponent, type ComponentProps } from "@mokly/mokly";

import { libraryMetadata } from "../metadata.js";
import {
  optionalFlag,
  previewViewport,
  scheme,
  schemeDestinations,
} from "../schemas.js";

import { ViewControlsView } from "./view-controls.view.js";

const propSchema = {
  kind: "object",
  properties: {
    selection: previewViewport,
    scheme,
    highlight: optionalFlag,
    unavailable: {
      schema: {
        kind: "enum",
        values: ["empty", "unavailable", "comparison", "removed"],
      },
      optional: true,
    },
    schemeDisabled: optionalFlag,
    /** Omitted keeps the scheme control; `false` leaves the viewport alone. */
    schemeControl: optionalFlag,
    destinations: schemeDestinations,
  },
} as const;
export type ViewControlsProps = ComponentProps<typeof propSchema, []>;
const sample = {
  selection: "desktop",
  scheme: "light",
  destinations: {},
} as const;
export const viewControls = defineComponent({
  ...libraryMetadata(
    "controls",
    "view-controls",
    "View controls",
    "Viewport, theme and component highlighting controls.",
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
    scheme: {
      kind: "select",
      label: "Theme",
      options: scheme.schema.values.map((value) => ({ label: value, value })),
    },
    schemeControl: { kind: "boolean", label: "Scheme control" },
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
    {
      id: "viewport-only",
      title: "Viewport only",
      props: { ...sample, selection: "both", schemeControl: false },
    },
  ],
});
