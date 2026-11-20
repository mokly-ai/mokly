import { Avatar } from "@firna/ui/avatar";

import { componentInput, componentMetadata } from "./metadata";

export const avatarInput = componentInput({
  ...componentMetadata(
    "Avatar",
    "A person's initials beside their contribution.",
  ),
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["label", "tone"],
    properties: {
      label: { type: "string" },
      tone: { enum: ["soft", "solid"] },
      shape: { enum: ["circle", "square"] },
      size: { type: "number" },
      decorative: { type: "boolean" },
    },
  },
  props: { label: "AL", tone: "soft", shape: "circle", size: 32 },
  controls: {
    label: { kind: "text" },
    tone: {
      kind: "select",
      options: [
        { label: "Soft", value: "soft" },
        { label: "Solid", value: "solid" },
      ],
    },
    shape: {
      kind: "select",
      options: [
        { label: "Circle", value: "circle" },
        { label: "Square", value: "square" },
      ],
    },
    decorative: { kind: "boolean" },
  },
  render: ({ label, tone, shape, size = 32, decorative }) => (
    <Avatar
      label={label}
      tone={tone}
      shape={shape}
      size={size}
      decorative={decorative}
      testID="firna-avatar"
    />
  ),
  variants: [
    {
      slug: "soft",
      title: "Soft",
      props: { label: "AL", tone: "soft", shape: "circle", size: 32 },
    },
    {
      slug: "solid",
      title: "Solid",
      props: { label: "JD", tone: "solid", shape: "square", size: 32 },
    },
  ],
});
