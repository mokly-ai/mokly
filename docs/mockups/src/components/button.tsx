import { Button, createButtonStyles } from "@firna/ui/button";
import { useSharedUiTheme } from "@firna/ui/theme";
import { Label, resolveTypographyColor } from "@firna/ui/typography";
import { useMemo } from "react";
import { Text, View } from "react-native";

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
  "history",
] as const;

/** The glyph vocabulary an action is allowed to draw. */
export type ButtonIcon = (typeof buttonIcons)[number];

type ButtonTone = "primary" | "secondary" | "quiet" | "danger";

/** The text role of a label in each tone, as the package paints its own. */
const labelRoles = {
  primary: "inverse",
  secondary: "default",
  quiet: "default",
  danger: "danger",
} as const satisfies Record<ButtonTone, string>;

/** How each part of a led label gives up its width on a narrow surface. */
const yields = {
  lead: { flexShrink: 100, minWidth: 0 },
  label: { flexShrink: 1, minWidth: 0 },
  fixed: { flexShrink: 0 },
} as const;

/**
 * A label that a muted lead comes before, such as a workspace before its
 * project: the lead, a slash and the label, each on one line in the Button's
 * own label type, then the switcher's chevron when the Button carries one. The
 * lead and the slash take the muted text role at the regular weight, and the
 * label keeps its tone's ink and the Button's weight. The lead gives up its
 * width before the label gives up any, and each is cut with an ellipsis. The
 * Button draws them as its own content, so the whole row is one control.
 */
function LeadLabel({
  lead,
  label,
  tone,
  size,
  chevron,
}: {
  lead: string;
  label: string;
  tone: ButtonTone;
  size: "sm" | "md" | "lg";
  chevron: boolean;
}) {
  const theme = useSharedUiTheme();
  const type = useMemo(
    () => createButtonStyles(theme, size).label,
    [theme, size],
  );
  const muted = {
    color: resolveTypographyColor(theme.colors, "muted"),
    fontWeight: "400",
  } as const;
  const ink = { color: resolveTypographyColor(theme.colors, labelRoles[tone]) };
  return (
    <>
      <Text numberOfLines={1} style={[type, muted, yields.lead]}>
        {lead}
      </Text>
      <Text numberOfLines={1} style={[type, muted, yields.fixed]}>
        {" / "}
      </Text>
      <Text numberOfLines={1} style={[type, ink, yields.label]}>
        {label}
      </Text>
      {chevron && (
        <View aria-hidden style={[yields.fixed, { pointerEvents: "none" }]}>
          <Icon name="switcher" size={14} />
        </View>
      )}
    </>
  );
}

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
    },
    { viewport },
  ) => (
    <Button
      accessibilityLabel={
        accessibilityLabel ??
        (lead === undefined ? undefined : lead + " / " + label)
      }
      content={
        lead === undefined || busy ? undefined : (
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
