import { createButtonStyles } from "@firna/ui/button";
import { useSharedUiTheme } from "@firna/ui/theme";
import { resolveTypographyColor } from "@firna/ui/typography";
import { useMemo } from "react";
import { Text, View } from "react-native";

import type { ActionTone } from "./action";
import { Icon } from "./icons";

/** The text role of a label in each tone, as the package paints its own. */
const labelRoles = {
  primary: "inverse",
  secondary: "default",
  quiet: "default",
  danger: "danger",
} as const satisfies Record<ActionTone, string>;

/** How each part of a led label gives up its width on a narrow surface. */
const yields = {
  lead: { flexShrink: 100, minWidth: 0 },
  label: { flexShrink: 1, minWidth: 0 },
  fixed: { flexShrink: 0 },
} as const;

/**
 * A label that a muted lead comes before, as the catalogue's registered Button
 * draws it: the lead, a slash and the label, each on one line in the Button's
 * own label type, then the switcher's chevron when the control carries one.
 * The lead and the slash take the muted text role at the regular weight, and
 * the label keeps its tone's ink and the Button's weight. The lead gives up
 * its width before the label gives up any, and each is cut with an ellipsis.
 * The Button draws them as its own content, so the whole row is one control.
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
  tone: ActionTone;
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
