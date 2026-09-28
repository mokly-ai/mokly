import { defineComponent, type ComponentProps } from "@mokly/mokly";

import { libraryMetadata } from "../metadata.js";
import { comparisonDestinations, comparisonMode, flag } from "../schemas.js";

import { ComparisonToolbarView } from "./comparison-toolbar.view.js";

const propSchema = {
  kind: "object",
  properties: {
    mode: comparisonMode,
    eligible: flag,
    accessible: flag,
    scrollTogether: flag,
    destinations: comparisonDestinations,
  },
} as const;
export type ComparisonToolbarProps = ComponentProps<typeof propSchema, []>;
export const comparisonToolbar = defineComponent({
  ...libraryMetadata(
    "controls",
    "comparison-toolbar",
    "Comparison toolbar",
    "Display modes for an eligible screen comparison.",
  ),
  propSchema,
  controls: {
    mode: {
      kind: "select",
      label: "Mode",
      options: comparisonMode.schema.values.map((value) => ({
        label: value,
        value,
      })),
    },
    eligible: { kind: "boolean", label: "Eligible" },
    scrollTogether: { kind: "boolean", label: "Scroll together" },
  },
  render: ComparisonToolbarView,
  variants: [
    ...comparisonMode.schema.values.map((mode) => ({
      id: `design-ui-comparison-toolbar-${mode}`,
      title: mode,
      props: {
        mode,
        eligible: true,
        accessible: true,
        scrollTogether: true,
        destinations: {},
      },
    })),
    {
      id: "design-ui-comparison-toolbar-side-by-side-apart",
      title: "side-by-side-apart",
      props: {
        mode: "side-by-side",
        eligible: true,
        accessible: true,
        scrollTogether: false,
        destinations: {},
      },
    },
  ],
});
