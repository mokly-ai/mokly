import { defineComponent } from "@mokly/mokly";

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

/** The View details Action: padding on its two sides only. */
const action = {
  top: 0,
  right: 10,
  bottom: 0,
  left: 10,
  width: 92,
  height: 30,
} as const;

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
      props: {
        top: 10,
        right: 12,
        bottom: 10,
        left: 12,
        width: 326,
        height: 108,
      },
    },
  ],
});
