import { defineComponent } from "@mokly/mokly";

import { libraryMetadata } from "../metadata.js";
import { flag, type LibraryProps } from "../schemas.js";

import { FramesFilterView } from "./frames-filter.view.js";

const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["viewports", "mobile", "desktop", "light", "dark", "highlight"],
  properties: {
    viewports: flag,
    mobile: flag,
    desktop: flag,
    light: flag,
    dark: flag,
    lightOnly: flag,
    single: flag,
    highlight: flag,
    unavailable: {
      enum: ["empty", "unavailable", "loading", "failed", "removed"],
    },
  },
} as const;
export type FramesFilterProps = LibraryProps<typeof propSchema>;

const screen = {
  viewports: true,
  mobile: true,
  desktop: true,
  light: true,
  dark: true,
  highlight: false,
} as const;

export const framesFilter = defineComponent({
  ...libraryMetadata(
    "inspector",
    "frames-filter",
    "Frames filter",
    "The frames that the canvas shows, by viewport and scheme, and Highlight components. A use case's filter chooses one viewport and one scheme.",
  ),
  propSchema,
  props: screen,
  controls: {
    mobile: { kind: "boolean", label: "Mobile" },
    desktop: { kind: "boolean", label: "Desktop" },
    light: { kind: "boolean", label: "Light" },
    dark: { kind: "boolean", label: "Dark" },
    highlight: { kind: "boolean", label: "Highlight components" },
  },
  render: FramesFilterView,
  variants: [
    { slug: "screen", title: "Screen", props: screen },
    {
      slug: "component",
      title: "Component set",
      props: { ...screen, viewports: false, unavailable: "empty" },
    },
    {
      slug: "light-only",
      title: "Light only",
      props: { ...screen, dark: false, lightOnly: true, unavailable: "empty" },
    },
    {
      slug: "dark-hidden",
      title: "Dark hidden",
      props: { ...screen, dark: false, highlight: true },
    },
  ],
});
