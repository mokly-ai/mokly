import { Textarea } from "@firna/ui/input";
import { componentInput, componentMetadata } from "./metadata";
import { staticNoop } from "./static-controls";

export const textareaInput = componentInput({
  ...componentMetadata("Textarea", "A labelled comment or review summary."),
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["label"],
    properties: {
      label: { type: "string" },
      value: { type: "string" },
      error: { type: "string" },
      disabled: { type: "boolean" },
    },
  },
  props: { label: "Comment", value: "" },
  controls: {
    label: { kind: "text" },
    value: { kind: "text" },
    error: { kind: "text" },
    disabled: { kind: "boolean" },
  },
  render: ({ label, value, error, disabled }, { viewport }) => (
    <div className="field-layout">
      <Textarea
        label={label}
        value={value}
        error={error}
        size={viewport === "mobile" ? "lg" : "md"}
        numberOfLines={4}
        onChangeText={staticNoop}
        editable={!disabled}
        aria-disabled={Boolean(disabled)}
        tabIndex={disabled ? -1 : 0}
        testID="firna-textarea"
      />
    </div>
  ),
  variants: [
    {
      slug: "empty",
      title: "Empty",
      props: { label: "Comment", value: "" },
    },
    {
      slug: "retry",
      title: "Retained draft",
      props: {
        label: "Comment",
        value: "The next step is clear on mobile.",
        error: "Comment couldn't be posted. Try again.",
      },
    },
  ],
});
