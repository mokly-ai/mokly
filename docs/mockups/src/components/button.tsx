import { Button } from "@firna/ui/button";
import { Label } from "@firna/ui/typography";

import { Icon, icons } from "../screens/product/icons";

import { componentInput, componentMetadata } from "./metadata";
import { staticNoop } from "./static-controls";

/** Serializable glyph names an action may carry before its label. */
export const buttonIcons = [
  "github",
  "start",
  "retry",
  "external",
  "signOut",
] as const;

/** The glyph vocabulary an action is allowed to draw. */
export type ButtonIcon = (typeof buttonIcons)[number];

/**
 * The smallest box a control draws on a touch viewport, in px. The placeholder
 * of a control reads it too, so a control and its placeholder share one box.
 */
export const touchTarget = 44;

export const buttonInput = componentInput({
  ...componentMetadata(
    "Button",
    "Actions with a clear priority and visible focus.",
  ),
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["label", "tone"],
    properties: {
      label: { type: "string" },
      tone: { enum: ["primary", "secondary", "quiet", "danger"] },
      disabled: { type: "boolean" },
      /**
       * The control's write is running: the package draws its spinner in the
       * leading slot, sets `aria-busy` and refuses the press, and the control
       * keeps focus. Its label is then its working word.
       */
      busy: { type: "boolean" },
      arrow: { type: "boolean" },
      chevron: { type: "boolean" },
      block: { type: "boolean" },
      singleLine: { type: "boolean" },
      size: { enum: ["sm", "md", "lg"] },
      icon: { enum: buttonIcons },
      accessibilityLabel: { type: "string" },
    },
  },
  props: { label: "Get started", tone: "primary" },
  controls: {
    label: { kind: "text", label: "Label" },
    tone: {
      kind: "select",
      options: [
        { label: "Primary", value: "primary" },
        { label: "Secondary", value: "secondary" },
        { label: "Quiet", value: "quiet" },
        { label: "Danger", value: "danger" },
      ],
    },
    disabled: { kind: "boolean" },
    busy: { kind: "boolean" },
    arrow: { kind: "boolean" },
    chevron: { kind: "boolean" },
    block: { kind: "boolean" },
    singleLine: { kind: "boolean" },
    size: {
      kind: "select",
      options: [
        { label: "Compact", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
      ],
    },
    icon: {
      kind: "select",
      options: buttonIcons.map((value) => ({ label: value, value })),
    },
  },
  render: (
    {
      label,
      tone,
      disabled,
      busy,
      arrow,
      chevron,
      block,
      singleLine,
      size = "lg",
      icon,
      accessibilityLabel,
    },
    { viewport },
  ) => (
    <Button
      accessibilityLabel={accessibilityLabel}
      tone={tone === "quiet" ? "plain" : tone}
      size={size}
      block={block}
      numberOfLines={singleLine ? 1 : undefined}
      icon={icon ? icons[icon] : undefined}
      minTouchTarget={viewport === "mobile" ? touchTarget : undefined}
      hitSlop={viewport === "mobile" ? undefined : 8}
      disabled={disabled}
      busy={busy}
      onPress={staticNoop}
      testID={"firna-button-" + tone}
      trailing={
        arrow ? (
          <Label
            color={
              tone === "primary" || tone === "danger" ? "inverse" : "default"
            }
          >
            →
          </Label>
        ) : chevron ? (
          <Icon name="switcher" size={14} />
        ) : undefined
      }
    >
      {label}
    </Button>
  ),
  variants: [
    {
      slug: "danger",
      title: "Danger",
      props: { label: "Delete project", tone: "danger" },
    },
    {
      slug: "primary",
      title: "Primary",
      props: { label: "Get started", tone: "primary" },
    },
    {
      slug: "secondary",
      title: "Secondary",
      props: { label: "Read the docs", tone: "secondary" },
    },
    {
      slug: "quiet",
      title: "Quiet",
      props: { label: "View screen", tone: "quiet" },
    },
    {
      slug: "disabled",
      title: "Disabled",
      props: { label: "Continue", tone: "primary", disabled: true },
    },
  ],
});
