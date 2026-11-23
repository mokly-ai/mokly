import { DropdownList, useDropdownSurfaceStyles } from "@firna/ui/dropdown";
import type { DropdownListEntry } from "@firna/ui/dropdown";
import { PopoverSurface } from "@firna/ui/popover";
import type { ReactNode } from "react";
import { View } from "react-native";
import type { ViewStyle } from "react-native";

import type { ColorScheme } from "@mokly/mokly";

import "../../../../styles/product/viewer-canvas-menu.css";
import { staticNoop } from "../../../components/static-controls";
import { Segmented } from "../../../entries/design/segmented.mockup";
import { sample } from "../../../fixtures/product";
import { Icon } from "../icons";

import { ReaderAvatar } from "./account-trigger";
import { ShareGlyph } from "./glyphs";

/**
 * The open account menu and the open More menu. The live menus portal from
 * effects and draw nothing in static markup, so these drawings compose the
 * same public parts as the registered responsive menu: Firna's popover
 * surface and dropdown list in Firna's surface chrome on a pointer viewport,
 * and the rows inside the registered panel's bottom sheet on a touch one. The
 * rows are static pictures of their actions; the drawing's catalogue links
 * lead where they open.
 */

/** The height that a menu's list takes before it scrolls, in px. */
const listHeight = 320;

/**
 * Where a popover opens in its layer: its end edge on the trigger's, at the
 * menu's width.
 */
const placement: ViewStyle = { top: 0, right: 0, width: 260 };

/**
 * One menu row, with its action's glyph in a column of one width, so every
 * label in the menu starts at one edge.
 */
function row(id: string, label: string, glyph: ReactNode): DropdownListEntry {
  return {
    id,
    label,
    type: "item",
    leading: <span className="fo-canvas-menu-glyph">{glyph}</span>,
    onPress: staticNoop,
  };
}

/** Who is signed in: the avatar, the name and the address. */
function Identity() {
  return (
    <div className="fo-canvas-menu-identity">
      <ReaderAvatar initials={sample.viewer.initials} large />
      <span className="fo-canvas-menu-who">
        <span className="fo-canvas-menu-name">{sample.viewer.name}</span>
        <span className="fo-canvas-menu-email">{sample.viewer.email}</span>
      </span>
    </div>
  );
}

/**
 * The Theme choice, Light or Dark, with the document's own scheme selected:
 * a static picture of the choice that the device keeps.
 */
function ThemeChoice({
  scheme,
  instance,
}: {
  scheme: ColorScheme;
  instance: string;
}) {
  return (
    <div className="fo-canvas-menu-theme">
      <span className="fo-canvas-menu-label">Theme</span>
      <span className="fo-canvas-menu-choice">
        <Segmented
          moklyInstance={instance + "-theme"}
          label="Theme"
          value={scheme}
          options={[
            { label: "Light", value: "light" },
            { label: "Dark", value: "dark" },
          ]}
        />
      </span>
    </div>
  );
}

/**
 * The account rows that end both menus: who is signed in and the Theme
 * choice, above the menu's own items, Settings and Sign out. A popover marks
 * the keyboard's row, the first as it opens, with the library's ring; the
 * sheet has no keyboard and marks none.
 */
function AccountRows({
  scheme,
  instance,
  marked,
}: {
  scheme: ColorScheme;
  instance: string;
  marked: boolean;
}) {
  return (
    <DropdownList
      label="Account"
      listRole="menu"
      activeId={marked ? "settings" : null}
      highlightVariant="ringFill"
      maxHeight={listHeight}
      onClose={staticNoop}
      onActiveIdChange={staticNoop}
      header={
        <>
          <Identity />
          <ThemeChoice scheme={scheme} instance={instance} />
        </>
      }
      entries={[
        row("settings", "Settings", <Icon name="settings" />),
        row("sign-out", "Sign out", <Icon name="signOut" />),
      ]}
    />
  );
}

/**
 * More's own rows, above the account rows: the project, History and Share.
 * The package keeps its own search control in the compact bar, so More
 * carries no Search.
 */
function MoreRows({ marked }: { marked: boolean }) {
  return (
    <DropdownList
      label="More"
      listRole="menu"
      activeId={marked ? "project" : null}
      highlightVariant="ringFill"
      maxHeight={listHeight}
      onClose={staticNoop}
      onActiveIdChange={staticNoop}
      entries={[
        row(
          "project",
          sample.workspace + " / " + sample.project,
          <Icon name="project" />,
        ),
        row("history", "History", <Icon name="history" />),
        row("share", "Share", <ShareGlyph />),
      ]}
    />
  );
}

/** A popover in the package's surface chrome, named by its trigger's menu. */
function Popover({ label, children }: { label: string; children: ReactNode }) {
  const chrome = useDropdownSurfaceStyles();
  return (
    <View style={[chrome.surface, placement]}>
      <PopoverSurface label={label}>{children}</PopoverSurface>
    </View>
  );
}

/** The account menu, open under the full bar's avatar. */
export function AccountMenu({ scheme }: { scheme: ColorScheme }) {
  return (
    <Popover label="Account">
      <AccountRows scheme={scheme} instance="account-menu" marked />
    </Popover>
  );
}

/** More, open under its trigger in a narrow desktop window's compact bar. */
export function MorePopover({ scheme }: { scheme: ColorScheme }) {
  return (
    <Popover label="More">
      <MoreRows marked />
      <span className="fo-canvas-menu-rule" />
      <AccountRows scheme={scheme} instance="more-menu" marked={false} />
    </Popover>
  );
}

/**
 * More's rows in the phone's bottom sheet, where each row is a 44px touch
 * target.
 */
export function MoreSheetRows({ scheme }: { scheme: ColorScheme }) {
  return (
    <div className="fo-canvas-menu-sheet">
      <MoreRows marked={false} />
      <span className="fo-canvas-menu-rule" />
      <AccountRows scheme={scheme} instance="more-sheet" marked={false} />
    </div>
  );
}
