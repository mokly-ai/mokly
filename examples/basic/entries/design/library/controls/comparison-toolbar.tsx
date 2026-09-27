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
  },
  render: ComparisonToolbarView,
  variants: comparisonMode.schema.values.map((mode) => ({
    id: `design-ui-comparison-toolbar-${mode}`,
    title: mode,
    props: { mode, eligible: true, accessible: true, destinations: {} },
  })),
});
