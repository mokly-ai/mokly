import { defineComponent } from "@mokly/mokly";

import { CONTROLS_COPY } from "../../components/controls/parts/copy.js";
import { libraryMetadata } from "../metadata.js";
import { flag, text, type LibraryProps } from "../schemas.js";

import { PropFieldView } from "./prop-field.view.js";

const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["label", "inputId", "optional", "supplied"],
  properties: {
    label: text,
    inputId: text,
    description: text,
    error: text,
    optional: flag,
    supplied: flag,
  },
} as const;
const slots = ["control"] as const;
export type PropFieldProps = LibraryProps<typeof propSchema, typeof slots>;
const sample = {
  label: "label",
  inputId: "sample-label",
  optional: false,
  supplied: true,
} as const;
export const propField = defineComponent({
  ...libraryMetadata(
    "inspector",
    "prop-field",
    "Prop field",
    "Input framing, descriptions and validation for a component prop.",
  ),
  propSchema,
  props: sample,
  slots,
  controls: {
    label: { kind: "text", label: "Label" },
    description: { kind: "text", label: "Description" },
    error: { kind: "text", label: "Error" },
  },
  render: PropFieldView,
  variants: [
    {
      slug: "text",
      title: "Text",
      props: sample,
      slots: {
        control: (
          <input id="sample-label" type="text" defaultValue="Continue" />
        ),
      },
    },
    {
      slug: "boolean",
      title: "Boolean",
      props: { ...sample, label: "disabled", inputId: "sample-disabled" },
      slots: {
        control: <input id="sample-disabled" type="checkbox" />,
      },
    },
    {
      slug: "invalid-number",
      title: "Invalid number",
      props: {
        ...sample,
        label: "cornerRadius",
        inputId: "sample-radius",
        error: CONTROLS_COPY.numberError(0, 24, 1),
      },
      slots: {
        control: (
          <input
            id="sample-radius"
            type="number"
            min={0}
            max={24}
            defaultValue={32}
            aria-invalid="true"
            aria-describedby="sample-radius-error"
          />
        ),
      },
    },
    {
      slug: "select",
      title: "Selection",
      props: { ...sample, label: "emphasis", inputId: "sample-emphasis" },
      slots: {
        control: (
          <select id="sample-emphasis" defaultValue="strong">
            <option value="strong">Strong</option>
            <option value="quiet">Quiet</option>
          </select>
        ),
      },
    },
    {
      slug: "optional-unset",
      title: "Optional unset",
      props: {
        ...sample,
        label: "hint",
        inputId: "sample-hint",
        optional: true,
        supplied: false,
      },
      slots: {
        control: <input id="sample-hint" type="text" defaultValue="" />,
      },
    },
  ],
});
