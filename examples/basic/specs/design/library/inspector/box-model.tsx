import { defineComponent } from "@mokly/mokly";

import { WELCOME_INSTANCES } from "../../canvas/parts/instance_records.js";
import {
  contentSize,
  type CanvasInstance,
} from "../../canvas/parts/instances.js";
import { libraryMetadata } from "../metadata.js";
import type { LibraryProps } from "../schemas.js";

import { BoxModelView } from "./box-model.view.js";

const side = { type: "integer", minimum: 0, maximum: 400 } as const;
const length = { type: "integer", minimum: 0, maximum: 4000 } as const;
const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["top", "right", "bottom", "left", "width", "height"],
  properties: {
    top: side,
    right: side,
    bottom: side,
    left: side,
    width: length,
    height: length,
  },
} as const;
export type BoxModelProps = LibraryProps<typeof propSchema>;

/**
 * The box model of one of Welcome's instances, from its instance record:
 * its padding, and its content size inside the border and the padding.
 */
function measured(instance: CanvasInstance) {
  return { ...instance.padding, ...contentSize(instance) };
}

/** The View details Action: padding on its two sides only. */
const action = measured(WELCOME_INSTANCES.details);

const sideControl = (label: string) =>
  ({ kind: "number", label, minimum: 0, maximum: 400, step: 1 }) as const;
const lengthControl = (label: string) =>
  ({ kind: "number", label, minimum: 0, maximum: 4000, step: 1 }) as const;

export const boxModel = defineComponent({
  ...libraryMetadata(
    "inspector",
    "box-model",
    "Box model",
    "The selected instance's padding on each side, around its content size.",
  ),
  propSchema,
  props: action,
  controls: {
    top: sideControl("Top"),
    right: sideControl("Right"),
    bottom: sideControl("Bottom"),
    left: sideControl("Left"),
    width: lengthControl("Content width"),
    height: lengthControl("Content height"),
  },
  render: BoxModelView,
  variants: [
    { slug: "action", title: "Action", props: action },
    {
      slug: "toolbar",
      title: "Toolbar",
      props: measured(WELCOME_INSTANCES.toolbar),
    },
  ],
});
