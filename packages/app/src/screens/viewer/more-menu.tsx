import { DropdownMenu } from "@firna/ui/dropdown";
import type { DropdownListEntry } from "@firna/ui/dropdown";

import type { MoreAction } from "../../viewer/bar";
import { BarAction } from "../../viewer/chrome";

import type { SlotInput } from "./slots";

/**
 * More's row for one action it carries: the same overlay as the action's own
 * trigger, opened under the action's name, so focus can return to whichever
 * control carries the action when the overlay closes.
 */
function moreRow(
  input: SlotInput,
  reader: string,
  action: MoreAction,
): DropdownListEntry {
  switch (action) {
    case "projects":
      return {
        id: "projects",
        label: "Projects",
        secondary: input.project.name,
        type: "item",
        onPress: () => input.onPanel("projects"),
      };
    case "history":
      return {
        id: "history",
        label: "History",
        type: "item",
        onPress: () => input.onPanel("history"),
      };
    case "share":
      return {
        id: "share",
        label: "Share",
        disabled: !input.shareable,
        type: "item",
        onPress: () => input.onPanel("share"),
      };
    case "settings":
      return {
        id: "settings",
        label: "Settings",
        type: "item",
        onPress: input.onSettings,
      };
    case "account":
      return {
        id: "account",
        label: "Account",
        secondary: reader,
        type: "item",
        onPress: input.onAccount,
      };
  }
}

/** The rows More groups under its Viewer settings divider. */
const viewerSettings: ReadonlySet<MoreAction> = new Set([
  "settings",
  "account",
]);

/** More's rows, one for each action the placement gives it, in its order. */
function moreEntries(input: SlotInput, reader: string): DropdownListEntry[] {
  const entries: DropdownListEntry[] = [];
  for (const action of input.placement.more) {
    if (
      viewerSettings.has(action) &&
      !entries.some((entry) => entry.type === "divider")
    ) {
      entries.push({
        id: "viewer-divider",
        label: "Viewer settings",
        type: "divider",
      });
    }
    entries.push(moreRow(input, reader, action));
  }
  return entries;
}

/** What the compact bar's menu is called, and where it opens. */
export const moreMenu = {
  accessibilityLabel: "Viewer actions",
  align: "end",
  minWidth: 220,
} as const;

/**
 * The compact bar's one menu of the actions that the placement gives More.
 * `reader` is the whole name the account row shows beneath Account. The
 * trigger keeps the `more` slot name, which the fallback-to-package handoff
 * and the focus return to More both read.
 */
export function MoreMenu({
  input,
  reader,
}: {
  input: SlotInput;
  reader: string;
}) {
  return (
    <DropdownMenu
      {...moreMenu}
      entries={moreEntries(input, reader)}
      onOpenChange={input.onMoreOpen}
      open={input.moreOpen}
      testID="viewer-more-menu"
    >
      {({ open, toggle }) => (
        <BarAction
          label="More"
          testID="viewer-more"
          open={open}
          popup="menu"
          chevron
          onPress={toggle}
          slot="more"
          slotRef={input.refs.more}
        />
      )}
    </DropdownMenu>
  );
}
