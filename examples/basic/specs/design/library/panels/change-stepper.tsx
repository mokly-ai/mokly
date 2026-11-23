import { defineComponent } from "@mokly/mokly";

import { CANVAS_PAGES } from "../../canvas/parts/destinations.js";
import { libraryMetadata } from "../metadata.js";
import { destination, type LibraryProps } from "../schemas.js";

import { ChangeStepperView } from "./change-stepper.view.js";

const count = { type: "integer", minimum: 1, maximum: 999 } as const;
const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["position", "total"],
  properties: {
    position: count,
    total: count,
    previousDestination: destination,
    nextDestination: destination,
  },
} as const;
export type ChangeStepperProps = LibraryProps<typeof propSchema>;

/** Welcome, the first of the canonical branch's eleven changes. */
const first = {
  position: 1,
  total: 11,
  nextDestination: CANVAS_PAGES.addedChanges,
} as const;

/** Details, the second change, between Welcome and the Example tour. */
const second = {
  position: 2,
  total: 11,
  previousDestination: CANVAS_PAGES.changesCurrent,
  nextDestination: CANVAS_PAGES.useCaseChanges,
} as const;

const countControl = (label: string) =>
  ({ kind: "number", label, minimum: 1, maximum: 999, step: 1 }) as const;

export const changeStepper = defineComponent({
  ...libraryMetadata(
    "panels",
    "change-stepper",
    "Change stepper",
    "Where the shown entry stands among the branch's changes, with Previous change and Next change.",
  ),
  propSchema,
  props: { position: first.position, total: first.total },
  controls: {
    position: countControl("Change"),
    total: countControl("Changes"),
  },
  render: ChangeStepperView,
  variants: [
    { slug: "first", title: "First change", props: first },
    { slug: "second", title: "Second change", props: second },
  ],
});
