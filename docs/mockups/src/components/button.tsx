import { Button } from "@firna/ui/button";
import { Label } from "@firna/ui/typography";

import { Icon, icons } from "../screens/product/icons";

import { LeadLabel, TooltipHolder } from "./button-parts";
import { componentInput, componentMetadata } from "./metadata";
import { staticNoop } from "./static-controls";

/**
 * Serializable glyph names an action may carry before its label, or instead
 * of it.
 */
export const buttonIcons = [
  "github",
  "start",
  "retry",
  "external",
  "signOut",
  "history",
  "settings",
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
      /**
       * A muted lead the Button draws before its label, with a slash between
       * them, such as a workspace before its project. It takes the place of
       * the leading icon and the arrow; a busy Button draws its working word
       * alone. Without an `accessibilityLabel`, the accessible name is the
       * lead, the slash and the label.
       */
      lead: { type: "string" },
      /**
       * Draw the icon alone in a square box, with the label as the accessible
       * name, unless an `accessibilityLabel` gives one, and that name as the
       * tooltip. It needs an `icon`; without one the Button draws its label.
       * It takes the place of the lead, the arrow and the chevron.
       */
      iconOnly: { type: "boolean" },
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
    lead: { kind: "text", label: "Lead" },
    iconOnly: { kind: "boolean" },
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
      lead,
      iconOnly,
    },
    { viewport },
  ) => {
    // The icon alone, named by the label, or by the caller's whole name.
    const glyph = iconOnly === true && icon !== undefined;
    const name = accessibilityLabel ?? label;
    const button = (
      <Button
        accessibilityLabel={
          glyph
            ? name
            : (accessibilityLabel ??
              (lead === undefined ? undefined : lead + " / " + label))
        }
        content={
          glyph || lead === undefined || busy ? undefined : (
            <LeadLabel
              lead={lead}
              label={label}
              tone={tone}
              size={size}
              chevron={chevron === true}
            />
          )
        }
        tone={tone === "quiet" ? "plain" : tone}
        size={size}
        block={block}
        numberOfLines={singleLine ? 1 : undefined}
        icon={icon ? icons[icon] : undefined}
        shape={glyph ? "square" : undefined}
        minTouchTarget={viewport === "mobile" ? touchTarget : undefined}
        hitSlop={viewport === "mobile" ? undefined : 8}
        disabled={disabled}
        busy={busy}
        onPress={staticNoop}
        testID={"firna-button-" + tone}
        trailing={
          glyph ? undefined : arrow ? (
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
        {glyph ? undefined : label}
      </Button>
    );
    return iconOnly === undefined ? (
      button
    ) : (
      <TooltipHolder title={glyph ? name : undefined}>{button}</TooltipHolder>
    );
  },
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
