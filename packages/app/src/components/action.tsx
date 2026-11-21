import { Button } from "@firna/ui/button";
import type { ButtonStateStyleArgs } from "@firna/ui/button";
import { SharedUiThemeProvider, useSharedUiTheme } from "@firna/ui/theme";
import { Label } from "@firna/ui/typography";
import { primaryActionUiTheme } from "@mokly-cloud/tokens/shared-ui-theme";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import type { ComponentProps } from "react";

import { useCompact } from "../layout/viewport";
import { follow } from "../navigation/follow";
import type { Write } from "../settings/write";

import { Icon, icons } from "./icons";
import type { IconName } from "./icons";
import { PendingName } from "./pending-name";

/** The glyphs an action may carry before its label. */
export type ActionIcon = Extract<
  IconName,
  "github" | "start" | "retry" | "external" | "signOut"
>;

/** One tone vocabulary covers every surface, as the control contract requires. */
export type ActionTone = "primary" | "secondary" | "quiet" | "danger";

/**
 * The smallest box an action draws on a compact surface, in px. A control's
 * placeholder reads it too, so the control and its placeholder share one box.
 */
export const touchTarget = 44;

/**
 * What a control announces, named by the package that renders it.
 *
 * `Button` destructures a fixed prop list and spreads nothing, so a DOM-style
 * spelling — `aria-label`, `aria-expanded` — is accepted by TypeScript as an
 * excess prop on a JSX element and then silently dropped before it reaches the
 * page. Taking these fields from the package's own props means a wrong name is
 * a compile error rather than a control that quietly announces nothing, and
 * every future member of the family is covered by the same line. `buttonRef`
 * rides along for a control that has to take focus when it appears.
 */
export type ActionSemantics = Pick<
  ComponentProps<typeof Button>,
  "accessibilityLabel" | "buttonRef" | "expanded" | "hasPopup" | "pressed"
>;

/**
 * The write a control sends, and the operation that the write runs, as a
 * screen reader hears it: "Creating workspace". The control takes its write's
 * refusal from the write, together with the write's wait. At rest it refuses a
 * press while the write has nothing to send. While the write works, the
 * control is its Write in progress: it keeps its place and its focus, the
 * package draws its spinner and refuses the press, and the operation is
 * announced once beside it. Its label is then its working word, which the
 * write's own label gives. A control that sends no write takes neither.
 */
type ActionWrite =
  | { write?: undefined; operation?: undefined }
  | { write: Pick<Write, "working" | "sendable">; operation: string };

export type ActionProps = ActionSemantics &
  ActionWrite & {
    label: string;
    tone?: ActionTone;
    size?: "sm" | "md" | "lg";
    block?: boolean;
    /**
     * Whether the control refuses a press while it is at rest, for a reason
     * other than its own write, such as a permission the reader lacks. Its
     * write's own refusal comes with `write`. A busy control stays enabled, so
     * it keeps its focus, and refuses the press because it is busy.
     */
    disabled?: boolean;
    icon?: ActionIcon;
    chevron?: boolean;
    arrow?: boolean;
    /**
     * Where a press goes when the action has no `onPress`: an application
     * route, pushed through the router, or an address outside the application
     * — another site, or another program's scheme — opened in this tab.
     */
    href?: string;
    onPress?: () => void;
    testID?: string;
    /** Keep a constrained chrome label on one ellipsized line. */
    singleLine?: boolean;
  };

/**
 * A hovered primary action lifts by one pixel and keeps its fill, so its
 * hover does not rely on colour alone. The lift applies only while a hovering
 * pointer, never a touch, is over the enabled and idle control, and a press
 * sets it back down. A transform moves no layout box, and no transition
 * animates it.
 */
function primaryHoverLift({
  busy,
  disabled,
  hovered,
  pressed,
}: ButtonStateStyleArgs) {
  return hovered && !disabled && !busy && !pressed
    ? { transform: [{ translateY: -1 }] }
    : null;
}

/**
 * Every action in the product is the package Button through one mapping:
 * emphasis chooses the size, the viewport chooses the target, and a
 * destination is followed on press rather than drawn as a second kind of
 * control. The Button renders no anchor, so an address outside the
 * application is still this one control: pressing it opens the address in
 * this tab. A primary action sits in its scoped theme, whose boundary draws
 * no box, so its hover keeps the resting fill and the lift above stands in
 * for a darker one.
 */
export function Action({
  label,
  tone = "secondary",
  size = "lg",
  block,
  disabled,
  icon,
  chevron,
  arrow,
  href,
  onPress,
  testID,
  singleLine,
  write,
  operation,
  ...semantics
}: ActionProps) {
  const router = useRouter();
  const compact = useCompact();
  const theme = useSharedUiTheme();
  const primaryTheme = useMemo(() => primaryActionUiTheme(theme), [theme]);
  const press = useCallback(() => {
    if (onPress) {
      onPress();
      return;
    }
    if (href) follow(href, router);
  }, [onPress, href, router]);
  // The operation, while the write this control sends is working.
  const running = write?.working === true ? operation : undefined;
  // At rest, the control refuses a press for its own reason or while its
  // write has nothing to send. While the write works, `busy` refuses it.
  const refused = disabled === true || write?.sendable === false;
  const button = (
    <Button
      tone={tone === "quiet" ? "plain" : tone}
      size={size}
      block={block}
      disabled={running === undefined && refused}
      busy={running !== undefined}
      icon={icon ? icons[icon] : undefined}
      // A compact surface clears the 44px touch target; a pointer surface
      // keeps the control's own scale and widens the hit area instead.
      minTouchTarget={compact ? touchTarget : undefined}
      hitSlop={compact ? undefined : 8}
      onPress={press}
      testID={testID}
      numberOfLines={singleLine ? 1 : undefined}
      style={tone === "primary" ? primaryHoverLift : undefined}
      {...semantics}
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
  );
  return (
    <>
      {tone === "primary" ? (
        <SharedUiThemeProvider theme={primaryTheme}>
          {button}
        </SharedUiThemeProvider>
      ) : (
        button
      )}
      {/* The status is out of the layout, so the form around the control
          inserts nothing while the write works, and the control keeps its
          place in the tree, so it keeps its focus. */}
      {running !== undefined && <PendingName label={running} hidden />}
    </>
  );
}
