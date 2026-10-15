import { defineComponent } from "@mokly/mokly";

import { libraryMetadata } from "../metadata.js";
import {
  comparisonDestinations,
  comparisonMode,
  enumOptions,
  flag,
  type LibraryProps,
} from "../schemas.js";

import { ComparisonToolbarView } from "./comparison-toolbar.view.js";

const propSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "mode",
    "eligible",
    "accessible",
    "scrollTogether",
    "destinations",
  ],
  properties: {
    mode: comparisonMode,
    eligible: flag,
    accessible: flag,
    scrollTogether: flag,
    destinations: comparisonDestinations,
  },
} as const;
export type ComparisonToolbarProps = LibraryProps<typeof propSchema>;
/** Each saved mode's title, as the shell's mode group names it. */
const MODE_TITLES = {
  current: "Current",
  "side-by-side": "Side by side",
  overlay: "Overlay",
  difference: "Difference",
} as const satisfies Record<(typeof comparisonMode.enum)[number], string>;
const sample = {
  mode: "current",
  eligible: true,
  accessible: true,
  scrollTogether: true,
  destinations: {},
} as const;
export const comparisonToolbar = defineComponent({
  ...libraryMetadata(
    "controls",
    "comparison-toolbar",
    "Comparison toolbar",
    "Display modes for an eligible screen comparison.",
  ),
  propSchema,
  props: sample,
  controls: {
    mode: {
      kind: "select",
      label: "Mode",
      options: enumOptions(comparisonMode),
    },
    eligible: { kind: "boolean", label: "Eligible" },
    scrollTogether: { kind: "boolean", label: "Scroll together" },
  },
  render: ComparisonToolbarView,
  variants: [
    ...comparisonMode.enum.map((mode) => ({
      slug: mode,
      title: MODE_TITLES[mode],
      props: { ...sample, mode },
    })),
    {
      slug: "side-by-side-apart",
      title: "Side by side, scrolled apart",
      props: { ...sample, mode: "side-by-side", scrollTogether: false },
    },
  ],
});
