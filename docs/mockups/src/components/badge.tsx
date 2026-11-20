import { Badge } from "@firna/ui/badge";

import { componentInput, componentMetadata } from "./metadata";

export const badgeInput = componentInput({
  ...componentMetadata("Badge", "Concise status with a readable label."),
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["label", "tone"],
    properties: {
      label: { type: "string" },
      dot: { type: "boolean" },
      tone: { enum: ["neutral", "success", "warning", "danger"] },
    },
  },
  props: { label: "Open", tone: "neutral" },
  controls: {
    label: { kind: "text" },
    dot: { kind: "boolean" },
    tone: {
      kind: "select",
      options: [
        { label: "Neutral", value: "neutral" },
        { label: "Success", value: "success" },
        { label: "Warning", value: "warning" },
        { label: "Danger", value: "danger" },
      ],
    },
  },
  render: ({ label, tone, dot }) => (
    <Badge
      tone={tone === "success" ? "primary" : tone}
      variant="soft"
      dot={dot}
      testID={"firna-badge-" + tone}
    >
      {label}
    </Badge>
  ),
  variants: [
    {
      slug: "neutral",
      title: "Neutral",
      props: { label: "Open", tone: "neutral" },
    },
    {
      slug: "success",
      title: "Success",
      props: { label: "Approved", tone: "success" },
    },
    {
      slug: "warning",
      title: "Warning",
      props: { label: "Needs review", tone: "warning" },
    },
    {
      slug: "danger",
      title: "Danger",
      props: { label: "Unable to publish", tone: "danger" },
    },
  ],
});
