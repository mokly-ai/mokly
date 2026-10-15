import { defineComponent } from "@mokly/mokly";

import { libraryMetadata } from "../metadata.js";
import { flag, type LibraryProps } from "../schemas.js";

import { AppearanceSelectorView } from "./appearance-selector.view.js";

const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["value", "compact"],
  properties: {
    value: { enum: ["auto", "light", "dark"] },
    compact: flag,
    otherSchemeChanged: flag,
  },
} as const;
export type AppearanceSelectorProps = LibraryProps<typeof propSchema>;
export const appearanceSelector = defineComponent({
  ...libraryMetadata(
    "chrome",
    "appearance-selector",
    "Appearance selector",
    "The standalone catalogue's Auto, Light and Dark interface setting.",
  ),
  propSchema,
  props: { value: "auto", compact: false },
  controls: {
    value: {
      kind: "select",
      label: "Appearance",
      options: [
        { label: "Auto", value: "auto" },
        { label: "Light", value: "light" },
        { label: "Dark", value: "dark" },
      ],
    },
    compact: { kind: "boolean", label: "Compact" },
    otherSchemeChanged: { kind: "boolean", label: "Other theme changed" },
  },
  render: AppearanceSelectorView,
  variants: [
    {
      slug: "auto",
      title: "Auto",
      props: { value: "auto", compact: false },
    },
    {
      slug: "light",
      title: "Light",
      props: { value: "light", compact: false },
    },
    {
      slug: "dark",
      title: "Dark",
      props: { value: "dark", compact: false },
    },
    {
      slug: "compact",
      title: "Compact",
      props: { value: "dark", compact: true },
    },
  ],
});
