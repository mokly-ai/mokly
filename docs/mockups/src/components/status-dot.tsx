import { StatusDot } from "@firna/ui/status-dot";

import { componentInput, componentMetadata } from "./metadata";

export const statusDotInput = componentInput({
  ...componentMetadata(
    "Status dot",
    "A status indicator with an accessible name when shown alone.",
  ),
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["tone"],
    properties: {
      tone: { enum: ["neutral", "success", "warning", "danger"] },
      label: { type: "string" },
    },
  },
  props: { tone: "neutral", label: "Open" },
  controls: {
    label: { kind: "text" },
    tone: {
      kind: "select",
      options: (["neutral", "success", "warning", "danger"] as const).map(
        (value) => ({ label: value, value }),
      ),
    },
  },
  render: ({ tone, label }) => (
    <StatusDot
      tone={tone === "success" ? "primary" : tone}
      label={label}
      size="sm"
      testID="firna-status-dot"
    />
  ),
  variants: [
    {
      slug: "neutral",
      title: "Neutral",
      props: { tone: "neutral", label: "Open" },
    },
    {
      slug: "success",
      title: "Success",
      props: { tone: "success", label: "Approved" },
    },
    {
      slug: "warning",
      title: "Warning",
      props: { tone: "warning", label: "Needs review" },
    },
    {
      slug: "danger",
      title: "Danger",
      props: { tone: "danger", label: "Unable to publish" },
    },
  ],
});
