import { defineComponent } from "@mokly/mokly";

import { WELCOME_INSTANCES } from "../../canvas/parts/instance_records.js";
import {
  instanceSize,
  type CanvasInstance,
} from "../../canvas/parts/instances.js";
import { libraryMetadata } from "../metadata.js";
import { enumOptions, text, type LibraryProps } from "../schemas.js";

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
    border: { type: "integer", minimum: 0, maximum: 400 },
    kind: { enum: ["instance", "frame"] },
  },
} as const;
export type SelectionProps = LibraryProps<typeof propSchema>;

/**
 * The selection of one of Welcome's instances, from its instance record:
 * its size, and the padding and the border on the left side, which the
 * redline measures.
 */
function selected(instance: CanvasInstance) {
  return {
    name: instance.component,
    ...instanceSize(instance),
    padding: instance.padding.left,
    border: instance.border.left,
  };
}

/** The View details Action of Welcome, large enough for its redline. */
const action = selected(WELCOME_INSTANCES.details);

const sideControl = (label: string, minimum: number) =>
  ({ kind: "number", label, minimum, maximum: 400, step: 1 }) as const;
const lengthControl = (label: string) =>
  ({ kind: "number", label, minimum: 1, maximum: 4000, step: 1 }) as const;

export const selection = defineComponent({
  ...libraryMetadata(
    "canvas",
    "selection",
    "Selection",
    "The selected instance on a frame, with its outline and handles, its name and size, and its padding, or the selected frame, with its corners and size.",
  ),
  propSchema,
  props: { name: action.name, width: action.width, height: action.height },
  controls: {
    name: { kind: "text", label: "Name" },
    width: lengthControl("Width"),
    height: lengthControl("Height"),
    padding: sideControl("Padding", 1),
    border: sideControl("Border", 0),
    kind: {
      kind: "select",
      label: "Selects",
      options: enumOptions(propSchema.properties.kind),
    },
  },
  render: SelectionView,
  variants: [
    { slug: "action", title: "Action", props: action },
    {
      slug: "toolbar",
      title: "Toolbar",
      props: selected(WELCOME_INSTANCES.toolbar),
    },
    {
      slug: "small",
      title: "Without a redline",
      props: {
        name: WELCOME_INSTANCES.primary.component,
        ...instanceSize(WELCOME_INSTANCES.primary),
      },
    },
    {
      slug: "frame",
      title: "Frame",
      props: {
        name: "Disabled · Light",
        width: 320,
        height: 132,
        kind: "frame",
      },
    },
  ],
});
