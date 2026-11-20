import { defineComponent } from "@mokly/mokly";

import { libraryMetadata } from "../metadata.js";
import type { LibraryProps } from "../schemas.js";

import { SwipeDividerView } from "./swipe-divider.view.js";

const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["position"],
  properties: {
    position: { type: "integer", minimum: 5, maximum: 95 },
  },
} as const;
export type SwipeDividerProps = LibraryProps<typeof propSchema>;

/** The divider where Swipe opens, in the middle of the frame. */
const centred = { position: 50 } as const;

export const swipeDivider = defineComponent({
  ...libraryMetadata(
    "canvas",
    "swipe-divider",
    "Swipe divider",
    "The divider of Swipe on a frame: the version before on its left, the current version on its right, with a grip and a tag for each.",
  ),
  propSchema,
  props: centred,
  controls: {
    position: {
      kind: "number",
      label: "Position (%)",
      minimum: 5,
      maximum: 95,
      step: 1,
    },
  },
  render: SwipeDividerView,
  variants: [
    { slug: "centred", title: "Centred", props: centred },
    { slug: "moved", title: "Moved", props: { position: 32 } },
  ],
});
