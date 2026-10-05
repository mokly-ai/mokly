import { defineComponent, type ComponentProps } from "@mokly/mokly";

import { libraryMetadata } from "../metadata.js";
import { flag, optionalText, text } from "../schemas.js";

import { PropFieldView } from "./prop-field.view.js";

const propSchema = {
  kind: "object",
  properties: {
    label: text,
    inputId: text,
    description: optionalText,
    error: optionalText,
    optional: flag,
    supplied: flag,
  },
} as const;
const slots = ["control"] as const;
export type PropFieldProps = ComponentProps<typeof propSchema, typeof slots>;
export const propField = defineComponent({
  ...libraryMetadata(
    "inspector",
    "prop-field",
    "Prop field",
    "Input framing, descriptions and validation for a component prop.",
  ),
  propSchema,
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
      props: {
        label: "label",
        inputId: "sample-label",
        optional: false,
        supplied: true,
        control: (
          <input id="sample-label" type="text" defaultValue="Continue" />
        ),
      },
    },
    {
      slug: "boolean",
      title: "Boolean",
      props: {
        label: "disabled",
        inputId: "sample-disabled",
        optional: false,
        supplied: true,
        control: (
          <div className="ce-check-value">
            <input id="sample-disabled" type="checkbox" />
          </div>
        ),
      },
    },
    {
      slug: "invalid-number",
      title: "Invalid number",
      props: {
        label: "cornerRadius",
        inputId: "sample-radius",
        optional: false,
        supplied: true,
        error: "Enter a number from 0 to 24.",
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
      props: {
        label: "emphasis",
        inputId: "sample-emphasis",
        optional: false,
        supplied: true,
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
        label: "hint",
        inputId: "sample-hint",
        optional: true,
        supplied: false,
        control: (
          <div>
            <label className="ce-check-value">
              <input type="checkbox" />
              <span>Set hint</span>
            </label>
            <input
              className="ce-hint-value"
              id="sample-hint"
              type="text"
              defaultValue=""
            />
            <p className="ce-unset-value">Not set</p>
          </div>
        ),
      },
    },
  ],
});
