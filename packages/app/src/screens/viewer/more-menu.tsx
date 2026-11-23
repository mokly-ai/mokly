import { Popover } from "@firna/ui/popover";
import { useRef } from "react";

import { Icon } from "../../components/icons";
import { useCompact } from "../../layout/viewport";
import {
  AccountRows,
  menuPopover,
  popoverBody,
} from "../../viewer/account-menu";
import type { AccountReader } from "../../viewer/account-menu";
import type { BarPlacement, MoreAction } from "../../viewer/bar";
import { BarAction } from "../../viewer/chrome";
import { ShareGlyph } from "../../viewer/glyphs";
import { MenuBody, MenuList } from "../../viewer/menu-list";
import type { MenuItem } from "../../viewer/menu-list";
import { ViewerPanel } from "../../viewer/panel";
import type { ViewerPanel as PanelId } from "../../viewer/selection";

import type { SlotInput } from "./slots";

/** An action of More's own, above the account rows. */
type OwnAction = Exclude<MoreAction, "account">;

/** What More's own rows read of the viewer's slot input. */
export interface MoreRowsInput {
  placement: BarPlacement;
  workspace?: string;
  project: { name: string };
  shareable: boolean;
  onPanel: (panel: PanelId) => void;
}

/**
 * More's row for one action it carries: the same overlay as the action's own
 * trigger, opened under the action's name, so focus can return to whichever
 * control carries the action when the overlay closes.
 */
function moreRow(input: MoreRowsInput, action: OwnAction): MenuItem {
  switch (action) {
    case "projects":
      return {
        kind: "action",
        id: "projects",
        label: input.workspace
          ? input.workspace + " / " + input.project.name
          : input.project.name,
        glyph: <Icon name="project" />,
        onSelect: () => input.onPanel("projects"),
      };
    case "history":
      return {
        kind: "action",
        id: "history",
        label: "History",
        glyph: <Icon name="history" />,
        onSelect: () => input.onPanel("history"),
      };
    case "share":
      return {
        kind: "action",
        id: "share",
        label: "Share",
        glyph: <ShareGlyph />,
        disabled: !input.shareable,
        onSelect: () => input.onPanel("share"),
      };
  }
}

/** More's own rows, one for each action the placement gives it, in its order. */
export function moreItems(input: MoreRowsInput): MenuItem[] {
  return input.placement.more
    .filter((action): action is OwnAction => action !== "account")
    .map((action) => moreRow(input, action));
}

/**
 * More's rows: its own actions, then a hairline and the account rows, which
 * the placement gives More on the compact bar.
 */
function MoreRows({
  input,
  rows,
  reader,
}: {
  input: SlotInput;
  rows: readonly MenuItem[];
  reader: AccountReader;
}) {
  const account = input.placement.more.includes("account");
  return (
    <>
      <MenuList label="More" items={rows} />
      {account && (
        <>
          <span className="fo-canvas-menu-rule" />
          <AccountRows reader={reader} actions={input.account} />
        </>
      )}
    </>
  );
}

/** The row that More opens on: its first own action, else Settings. */
function firstRow(rows: readonly MenuItem[]): string {
  return rows[0]?.id ?? "settings";
}

/**
 * The compact bar's one menu of the actions that the placement gives More.
 * On a pointer viewport it opens as a non-modal popover under its trigger; on
 * a touch viewport the viewer screen opens `MoreSheet` instead, and the
 * trigger only reports it open. `reader` is who the account rows name. The
 * trigger keeps the `more` slot name, which the fallback-to-package handoff
 * and the focus return to More both read.
 */
export function MoreMenu({
  input,
  reader,
}: {
  input: SlotInput;
  reader: AccountReader;
}) {
  const touch = useCompact();
  const first = useRef<HTMLElement | null>(null);
  const rows = moreItems(input);
  return (
    <Popover
      {...menuPopover}
      label="More"
      open={input.moreOpen && !touch}
      onOpenChange={input.onMoreOpen}
      initialFocusRef={first}
      trigger={() => (
        <BarAction
          label="More"
          testID="viewer-more"
          open={input.moreOpen}
          popup="menu"
          chevron
          onPress={() => input.onMoreOpen(!input.moreOpen)}
          slot="more"
          slotRef={input.refs.more}
        />
      )}
    >
      {({ placement }) => (
        <MenuBody
          first={firstRow(rows)}
          firstRef={first}
          className="fo-canvas-menu-body"
          style={popoverBody(placement)}
        >
          <MoreRows input={input} rows={rows} reader={reader} />
        </MenuBody>
      )}
    </Popover>
  );
}

/**
 * More on a touch viewport: the registered panel's bottom sheet, titled More,
 * with Close, over the inert viewer. It takes the document's `main` landmark
 * and `h1` exactly as a panel does, and each of its rows is a 44px target.
 */
export function MoreSheet({
  input,
  reader,
}: {
  input: SlotInput;
  reader: AccountReader;
}) {
  const rows = moreItems(input);
  return (
    <ViewerPanel id="more" title="More" onClose={() => input.onMoreOpen(false)}>
      <MenuBody
        first={firstRow(rows)}
        className="fo-canvas-menu-body fo-canvas-menu-sheet"
      >
        <MoreRows input={input} rows={rows} reader={reader} />
      </MenuBody>
    </ViewerPanel>
  );
}

/**
 * More while the route reads the project: the same popover's trigger, closed
 * and with nothing to list, so it keeps the place the menu gives it, and
 * waits there, disabled.
 */
export function MoreMenuWait() {
  return (
    <Popover
      {...menuPopover}
      label="More"
      open={false}
      trigger={() => (
        <BarAction label="More" popup="menu" chevron slot="more" waiting />
      )}
    >
      {null}
    </Popover>
  );
}
