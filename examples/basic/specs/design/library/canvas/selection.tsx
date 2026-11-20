import { defineComponent } from "@mokly/mokly";

import { libraryMetadata } from "../metadata.js";
import { text, type LibraryProps } from "../schemas.js";

import { SelectionView } from "./selection.view.js";

const length = { type: "integer", minimum: 1, maximum: 4000 } as const;
const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "width", "height"],
  properties: {
    name: text,
    width: length,
    height: length,
    padding: { type: "integer", minimum: 1, maximum: 400 },
  },
} as const;
export type SelectionProps = LibraryProps<typeof propSchema>;

/** The View details Action of Welcome, large enough for its redline. */
const action = { name: "Action", width: 112, height: 30, padding: 10 } as const;

const lengthControl = (label: string) =>
  ({ kind: "number", label, minimum: 1, maximum: 4000, step: 1 }) as const;

export const selection = defineComponent({
  ...libraryMetadata(
    "canvas",
    "selection",
    "Selection",
    "The selected instance on a frame: its outline and handles, its name and size, and its padding.",
  ),
  propSchema,
  props: { name: action.name, width: action.width, height: action.height },
  controls: {
    name: { kind: "text", label: "Component" },
    width: lengthControl("Width"),
    height: lengthControl("Height"),
    padding: {
      kind: "number",
      label: "Padding",
      minimum: 1,
      maximum: 400,
      step: 1,
    },
  },
  render: SelectionView,
  variants: [
    { slug: "action", title: "Action", props: action },
    {
      slug: "toolbar",
      title: "Toolbar",
      props: { name: "Toolbar", width: 350, height: 128, padding: 12 },
    },
    {
      slug: "small",
      title: "Without a redline",
      props: { name: "Action", width: 107, height: 26 },
    },
  ],
});
