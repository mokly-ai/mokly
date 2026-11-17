import { SegmentedControl } from "@firna/ui/segmented";
import { componentInput, componentMetadata } from "./metadata";
import { staticNoop } from "./static-controls";

export const segmentedInput = componentInput({
  ...componentMetadata(
    "Segmented control",
    "A labelled choice with one selected value.",
  ),
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["label", "value", "options"],
    properties: {
      label: { type: "string" },
      value: { type: "string" },
      options: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "value"],
          properties: {
            label: { type: "string" },
            value: { type: "string" },
          },
        },
      },
      disabled: { type: "boolean" },
    },
  },
  props: {
    label: "Browse",
    value: "branches",
    options: [
      { label: "Branches", value: "branches" },
      { label: "Pull requests", value: "pull-requests" },
    ],
  },
  controls: { label: { kind: "text" }, disabled: { kind: "boolean" } },
  render: ({ label, options, value, disabled }, { viewport }) => (
    <SegmentedControl
      accessibilityLabel={label}
      options={options}
      value={value}
      disabled={disabled}
      onChange={staticNoop}
      animated={false}
      size={viewport === "mobile" ? "lg" : "md"}
      wrap
      testID="firna-segmented"
    />
  ),
  variants: [
    {
      slug: "branches",
      title: "Branches",
      props: {
        label: "Browse",
        value: "branches",
        options: [
          { label: "Branches", value: "branches" },
          { label: "Pull requests", value: "pull-requests" },
        ],
      },
    },
    {
      slug: "pull-requests",
      title: "Pull requests",
      props: {
        label: "Browse",
        value: "pull-requests",
        options: [
          { label: "Branches", value: "branches" },
          { label: "Pull requests", value: "pull-requests" },
        ],
      },
    },
  ],
});
