import { defineComponent, type ComponentProps } from "@mokly/mokly";

import { libraryMetadata } from "../metadata.js";
import {
  destination,
  optionalFlag,
  previewViewport,
  scheme,
  schemeDestinations,
} from "../schemas.js";

import { ViewControlsView } from "./view-controls.view.js";

const previewMode = {
  schema: { kind: "enum", values: ["static", "live"] },
  optional: true,
} as const;
const propSchema = {
  kind: "object",
  properties: {
    selection: previewViewport,
    scheme,
    highlight: optionalFlag,
    unavailable: {
      schema: {
        kind: "enum",
        values: ["empty", "unavailable", "comparison", "removed", "live"],
      },
      optional: true,
    },
    schemeDisabled: optionalFlag,
    previewMode,
    previewModeDisabled: optionalFlag,
    previewModeDestinations: {
      schema: {
        kind: "object",
        properties: { static: destination, live: destination },
      },
      optional: true,
    },
    changedViews: {
      schema: {
        kind: "array",
        items: {
          kind: "object",
          properties: {
            viewport: {
              schema: { kind: "enum", values: ["mobile", "desktop"] },
            },
            scheme,
          },
        },
      },
      optional: true,
    },
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
    "Viewport, theme, preview mode and component highlighting controls.",
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
    previewMode: {
      kind: "select",
      label: "Preview mode",
      options: previewMode.schema.values.map((value) => ({
        label: value,
        value,
      })),
    },
    previewModeDisabled: { kind: "boolean", label: "Live unavailable" },
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
      id: "live",
      title: "Live preview",
      props: {
        ...sample,
        previewMode: "live",
        highlight: false,
        unavailable: "live",
      },
    },
    {
      id: "changed-views",
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
