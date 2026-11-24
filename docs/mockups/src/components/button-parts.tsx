import { createButtonStyles } from "@firna/ui/button";
import { useSharedUiTheme } from "@firna/ui/theme";
import { resolveTypographyColor } from "@firna/ui/typography";
import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { Icon } from "../screens/product/icons";

export type ButtonTone = "primary" | "secondary" | "quiet" | "danger";

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
export function LeadLabel({
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
 * Whether an element around the Button already holds the icon-only form's
 * tooltip, as a catalogue link's holder does, because the link takes the
 * control itself as its child.
 */
export const HeldTooltip = createContext(false);

/**
 * The element that gives an icon-only Button its tooltip. It takes no box, so
 * the Button keeps its own place, and it stays while `iconOnly` is set, so a
 * control that changes between its two drawings keeps its tree.
 */
export function TooltipHolder({
  title,
  children,
}: {
  title: string | undefined;
  children: ReactNode;
}) {
  return useContext(HeldTooltip) ? (
    children
  ) : (
    <span style={{ display: "contents" }} title={title}>
      {children}
    </span>
  );
}
