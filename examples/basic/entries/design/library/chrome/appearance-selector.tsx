import { defineComponent, type ComponentProps } from "@mokly/mokly";

import { libraryMetadata } from "../metadata.js";
import { flag } from "../schemas.js";

import { AppearanceSelectorView } from "./appearance-selector.view.js";

const propSchema = {
  kind: "object",
  properties: {
    value: { schema: { kind: "enum", values: ["auto", "light", "dark"] } },
    compact: flag,
  },
} as const;
export type AppearanceSelectorProps = ComponentProps<typeof propSchema, []>;
export const appearanceSelector = defineComponent({
  ...libraryMetadata(
    "chrome",
    "appearance-selector",
    "Appearance selector",
    "The standalone catalogue's Auto, Light and Dark interface setting.",
  ),
  propSchema,
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
  },
  render: AppearanceSelectorView,
  variants: [
    { id: "auto", title: "Auto", props: { value: "auto", compact: false } },
    { id: "light", title: "Light", props: { value: "light", compact: false } },
    { id: "dark", title: "Dark", props: { value: "dark", compact: false } },
    {
      id: "compact",
      title: "Compact",
      props: { value: "dark", compact: true },
    },
  ],
});
