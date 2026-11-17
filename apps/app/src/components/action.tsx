import { Button } from "@firna/ui/button";
import { Label } from "@firna/ui/typography";
import { useRouter } from "expo-router";
import { useCallback } from "react";
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
 * screen reader hears it: "Creating workspace". While the write works, the
 * control is its Write in progress: it keeps its place and its focus, the
 * package draws its spinner and refuses the press, and the operation is
 * announced once beside it. Its label is then its working word, which the
 * write's own label gives. A control that sends no write takes neither.
 */
type ActionWrite =
  | { write?: undefined; operation?: undefined }
  | { write: Pick<Write, "working">; operation: string };

export type ActionProps = ActionSemantics &
  ActionWrite & {
    label: string;
    tone?: ActionTone;
    size?: "sm" | "md" | "lg";
    block?: boolean;
    /**
     * Whether the control refuses a press while it is at rest. A busy control
     * stays enabled, so it keeps its focus, and refuses the press because it
     * is busy.
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
 * Every action in the product is the package Button through one mapping:
 * emphasis chooses the size, the viewport chooses the target, and a
 * destination is followed on press rather than drawn as a second kind of
 * control. The Button renders no anchor and takes no wrapper, so an address
 * outside the application is still this one control: pressing it opens the
 * address in this tab.
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
  const press = useCallback(() => {
    if (onPress) {
      onPress();
      return;
    }
    if (href) follow(href, router);
  }, [onPress, href, router]);
  // The operation, while the write this control sends is working.
  const running = write?.working === true ? operation : undefined;
  return (
    <>
      <Button
        tone={tone === "quiet" ? "plain" : tone}
        size={size}
        block={block}
        disabled={running === undefined && disabled}
        busy={running !== undefined}
        icon={icon ? icons[icon] : undefined}
        // A compact surface clears the 44px touch target; a pointer surface
        // keeps the control's own scale and widens the hit area instead.
        minTouchTarget={compact ? touchTarget : undefined}
        hitSlop={compact ? undefined : 8}
        onPress={press}
        testID={testID}
        numberOfLines={singleLine ? 1 : undefined}
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
      {/* The status is out of the layout, so the form around the control
          inserts nothing while the write works, and the control keeps its
          place in the tree, so it keeps its focus. */}
      {running !== undefined && <PendingName label={running} hidden />}
    </>
  );
}
