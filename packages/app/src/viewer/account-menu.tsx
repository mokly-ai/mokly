import type { DropdownPlacement } from "@firna/ui/dropdown";
import { Popover } from "@firna/ui/popover";
import { useRef } from "react";
import type { CSSProperties, RefObject } from "react";

import { Choice } from "../components/controls";
import { Icon } from "../components/icons";
import { site } from "../config";
import { parseThemeChoice } from "../theme/choice";
import { useThemeChoice } from "../theme/scheme";

import { AccountTrigger, ReaderAvatar } from "./account-trigger";
import { Slot } from "./chrome";
import { MenuBody, MenuList } from "./menu-list";
import type { MenuItem } from "./menu-list";

/** Who is signed in, as the account rows name them. */
export interface AccountReader {
  /** The reader's display name, or their address when they have set none. */
  name: string;
  /** The address beneath a display name. A reader named by it shows it once. */
  address?: string;
}

/** What the account rows' items do, in the account menu and in More. */
export interface AccountActions {
  /** Close the menu, then open the settings dialog on its index. */
  onSettings: () => void;
  /** Close the menu, then end the session. */
  onSignOut: () => void;
  /** Close the menu, as following one of its links to the site does. */
  onLeave: () => void;
}

/**
 * The account's items, in their order: Settings first and Sign out last, so a
 * menu opened from the keyboard starts on the account's own action, with Docs
 * and Changelog, which leave for the site, between them.
 */
export function accountItems(actions: AccountActions): MenuItem[] {
  return [
    {
      kind: "action",
      id: "settings",
      label: "Settings",
      glyph: <Icon name="settings" />,
      onSelect: actions.onSettings,
    },
    {
      kind: "link",
      id: "docs",
      label: "Docs",
      href: site.docs,
      onFollow: actions.onLeave,
    },
    {
      kind: "link",
      id: "changelog",
      label: "Changelog",
      href: site.changelog,
      onFollow: actions.onLeave,
    },
    {
      kind: "action",
      id: "sign-out",
      label: "Sign out",
      glyph: <Icon name="signOut" />,
      onSelect: actions.onSignOut,
    },
  ];
}

/** Who is signed in: the avatar, the name and, beneath it, the address. */
function Identity({ reader }: { reader: AccountReader }) {
  return (
    <div className="fo-canvas-menu-identity">
      <ReaderAvatar name={reader.name} large />
      <span className="fo-canvas-menu-who">
        <span className="fo-canvas-menu-name">{reader.name}</span>
        {reader.address !== undefined && (
          <span className="fo-canvas-menu-email">{reader.address}</span>
        )}
      </span>
    </div>
  );
}

/**
 * The Theme choice. It shows the scheme the application is drawn in, and a
 * choice applies at once and leaves the menu open, so the reader sees the
 * result and can change it back.
 */
function ThemeChoice() {
  const theme = useThemeChoice();
  return (
    <div className="fo-canvas-menu-theme">
      <span className="fo-canvas-menu-label">Theme</span>
      <span className="fo-canvas-menu-choice">
        <Choice
          label="Theme"
          value={theme.scheme}
          options={[
            { label: "Light", value: "light" },
            { label: "Dark", value: "dark" },
          ]}
          onChange={(next) => {
            const scheme = parseThemeChoice(next);
            if (scheme) theme.choose(scheme);
          }}
        />
      </span>
    </div>
  );
}

/**
 * The account rows that end the account menu and More: who is signed in and
 * the Theme choice, then the account's items.
 */
export function AccountRows({
  reader,
  actions,
}: {
  reader: AccountReader;
  actions: AccountActions;
}) {
  return (
    <>
      <div className="fo-canvas-menu-head">
        <Identity reader={reader} />
        <ThemeChoice />
      </div>
      <MenuList label="Account" items={accountItems(actions)} />
    </>
  );
}

/**
 * Where the account menu and More open on a pointer viewport: a 260px
 * non-modal popover in the package's menu chrome, end-aligned 6px below its
 * trigger, which is the package's own gutter.
 */
export const menuPopover = {
  align: "end",
  minWidth: 260,
  maxWidth: 260,
  maxHeight: 480,
} as const;

/** The popover surface's padding and border, above and below, in px. */
const surfaceInset = 14;

/** The popover's rows scroll within the room the placement leaves them. */
export function popoverBody(placement: DropdownPlacement): CSSProperties {
  return { maxHeight: placement.maxHeight - surfaceInset };
}

/**
 * The full bar's account control and the account menu it opens. The menu
 * opens on Settings; Escape and a press outside close it and return focus to
 * the avatar.
 */
export function AccountMenu({
  reader,
  open,
  onOpenChange,
  actions,
  slotRef,
}: {
  reader: AccountReader;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: AccountActions;
  slotRef: RefObject<HTMLSpanElement | null>;
}) {
  const first = useRef<HTMLElement | null>(null);
  return (
    <Slot name="account" slotRef={slotRef} className="fo-top-fixed">
      <Popover
        {...menuPopover}
        label="Account"
        open={open}
        onOpenChange={onOpenChange}
        initialFocusRef={first}
        trigger={() => (
          <AccountTrigger
            name={reader.name}
            open={open}
            onPress={() => onOpenChange(!open)}
            testID="viewer-account"
          />
        )}
      >
        {({ placement }) => (
          <MenuBody
            first="settings"
            firstRef={first}
            className="fo-canvas-menu-body"
            style={popoverBody(placement)}
          >
            <AccountRows reader={reader} actions={actions} />
          </MenuBody>
        )}
      </Popover>
    </Slot>
  );
}

/**
 * The account control while the route reads the project: the reader's
 * avatar, named, on a disabled Button that opens nothing yet.
 */
export function AccountMenuWait({ reader }: { reader: AccountReader }) {
  return (
    <Slot name="account" className="fo-top-fixed">
      <AccountTrigger name={reader.name} waiting />
    </Slot>
  );
}
