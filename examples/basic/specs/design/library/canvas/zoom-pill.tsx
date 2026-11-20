import { defineComponent } from "@mokly/mokly";

import { CANVAS_PAGES } from "../../canvas/parts/destinations.js";
import { libraryMetadata } from "../metadata.js";
import { destination, enumOptions, type LibraryProps } from "../schemas.js";

import { ZoomPillView } from "./zoom-pill.view.js";

const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["zoom", "presentation"],
  properties: {
    zoom: { type: "integer", minimum: 1, maximum: 800 },
    presentation: { enum: ["pill", "fit"] },
    zoomOutDestination: destination,
    zoomInDestination: destination,
    fitDestination: destination,
  },
} as const;
export type ZoomPillProps = LibraryProps<typeof propSchema>;

/** Own props hold only the keys that every saved variant sets. */
const base = {
  zoom: 38,
  presentation: "pill",
  fitDestination: CANVAS_PAGES.overview,
} as const;
const fitted = { ...base, zoomInDestination: CANVAS_PAGES.zoomed } as const;

export const zoomPill = defineComponent({
  ...libraryMetadata(
    "canvas",
    "zoom-pill",
    "Zoom pill",
    "The canvas zoom: zoom out, the zoom level, zoom in, and Fit.",
  ),
  propSchema,
  props: base,
  controls: {
    zoom: {
      kind: "number",
      label: "Zoom (%)",
      minimum: 1,
      maximum: 800,
      step: 1,
    },
    presentation: {
      kind: "select",
      label: "Presentation",
      options: enumOptions(propSchema.properties.presentation),
    },
  },
  render: ZoomPillView,
  variants: [
    { slug: "fitted", title: "Fitted", props: fitted },
    {
      slug: "zoomed",
      title: "Zoomed",
      props: {
        zoom: 100,
        presentation: "pill",
        fitDestination: CANVAS_PAGES.overview,
      },
    },
    {
      slug: "fit",
      title: "Fit only",
      props: {
        zoom: 38,
        presentation: "fit",
        fitDestination: CANVAS_PAGES.overview,
      },
    },
  ],
});
