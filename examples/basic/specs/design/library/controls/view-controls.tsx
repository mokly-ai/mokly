import { defineComponent } from "@mokly/mokly";

import { libraryMetadata } from "../metadata.js";
import {
  enumOptions,
  flag,
  previewViewport,
  type LibraryProps,
} from "../schemas.js";

import { ViewControlsView } from "./view-controls.view.js";

const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["selection"],
  properties: {
    selection: previewViewport,
    highlight: flag,
    unavailable: {
      enum: ["empty", "unavailable", "loading", "comparison", "removed"],
    },
    changedViews: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["viewport", "scheme"],
        properties: {
          viewport: { enum: ["mobile", "desktop"] },
          scheme: { enum: ["light", "dark"] },
        },
      },
    },
  },
} as const;
export type ViewControlsProps = LibraryProps<typeof propSchema>;
const sample = { selection: "desktop" } as const;
export const viewControls = defineComponent({
  ...libraryMetadata(
    "controls",
    "view-controls",
    "View controls",
    "Viewport and component highlighting controls.",
  ),
  propSchema,
  props: sample,
  controls: {
    selection: {
      kind: "select",
      label: "Viewport",
      options: enumOptions(previewViewport),
    },
    highlight: { kind: "boolean", label: "Highlight components" },
    unavailable: {
      kind: "select",
      label: "Unavailable reason",
      options: enumOptions(propSchema.properties.unavailable),
    },
  },
  render: ViewControlsView,
  variants: [
    {
      slug: "default",
      title: "Default",
      props: sample,
    },
    {
      slug: "both",
      title: "Both viewports",
      props: { ...sample, selection: "both" },
    },
    {
      slug: "highlighted",
      title: "Highlighted",
      props: { ...sample, highlight: true },
    },
    {
      slug: "unavailable",
      title: "Unavailable",
      props: { ...sample, highlight: false, unavailable: "empty" },
    },
    {
      slug: "changed-views",
      title: "Changed views",
      props: {
        ...sample,
        changedViews: [
          { viewport: "mobile", scheme: "dark" },
          { viewport: "desktop", scheme: "dark" },
        ],
      },
    },
  ],
});
