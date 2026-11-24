import { defineComponent } from "@mokly/mokly";

import {
  CANVAS_PAGES,
  WELCOME_MODES,
} from "../../canvas/parts/destinations.js";
import { libraryMetadata } from "../metadata.js";
import {
  destination,
  enumOptions,
  flag,
  text,
  type LibraryProps,
} from "../schemas.js";

import { CompareModesView } from "./compare-modes.view.js";

const mode = {
  enum: ["current", "side-by-side", "overlay", "difference", "swipe"],
} as const;
/**
 * A frame that Side by side can compare, as its chip names it: a screen's
 * frame by its viewport and scheme, or a variant set's frame by its saved
 * variant and scheme, with the glyph of its kind.
 */
const frameChip = {
  type: "object",
  additionalProperties: false,
  required: ["id", "label", "kind"],
  properties: {
    id: text,
    label: text,
    kind: { enum: ["desktop", "mobile", "component"] },
  },
} as const;
const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["mode", "comparable", "scrollTogether", "destinations"],
  properties: {
    mode,
    comparable: flag,
    scrollTogether: flag,
    destinations: {
      type: "object",
      additionalProperties: false,
      properties: {
        current: destination,
        "side-by-side": destination,
        overlay: destination,
        difference: destination,
        swipe: destination,
      },
    },
    frame: text,
    frames: { type: "array", items: frameChip },
    frameDestination: destination,
  },
} as const;
export type CompareModesProps = LibraryProps<typeof propSchema>;

/** Welcome in Current, where every mode opens its Changes artboard. */
const welcome = {
  mode: "current",
  comparable: true,
  scrollTogether: true,
  destinations: WELCOME_MODES,
} as const;

export const compareModes = defineComponent({
  ...libraryMetadata(
    "panels",
    "compare-modes",
    "Compare modes",
    "The compare modes of Changes as tiles with their keys, the compared frame of Side by side, Scroll together, and Refresh.",
  ),
  propSchema,
  props: welcome,
  controls: {
    mode: {
      kind: "select",
      label: "Mode",
      options: enumOptions(mode),
    },
    comparable: { kind: "boolean", label: "Comparable" },
    scrollTogether: { kind: "boolean", label: "Scroll together" },
  },
  render: CompareModesView,
  variants: [
    { slug: "current", title: "Current", props: welcome },
    {
      slug: "side-by-side",
      title: "Side by side",
      props: {
        ...welcome,
        mode: "side-by-side",
        frame: "desktop-light",
        frameDestination: CANVAS_PAGES.changesSide,
      },
    },
    { slug: "swipe", title: "Swipe", props: { ...welcome, mode: "swipe" } },
    {
      slug: "added",
      title: "Added entry",
      props: {
        mode: "current",
        comparable: false,
        scrollTogether: true,
        destinations: { current: CANVAS_PAGES.addedChanges },
      },
    },
  ],
});
