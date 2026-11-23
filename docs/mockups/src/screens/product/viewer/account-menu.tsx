import { useDropdownSurfaceStyles } from "@firna/ui/dropdown";
import { PopoverSurface } from "@firna/ui/popover";
import type { ReactNode } from "react";
import { View } from "react-native";
import type { ViewStyle } from "react-native";

import type { ColorScheme } from "@mokly/mokly";
import { MockLink } from "@mokly/mokly";

import { Segmented } from "../../../entries/design/segmented.mockup";
import { sample } from "../../../fixtures/product";
import { site } from "../../../fixtures/site";
import { Icon } from "../icons";

import { ReaderAvatar } from "./account-trigger";
import { ShareGlyph } from "./glyphs";

/**
 * The open account menu and the open More menu. The live menus portal from
 * effects and draw nothing in static markup, so these drawings compose the
 * same public parts: Firna's popover surface in Firna's surface chrome on a
 * pointer viewport, and the rows inside the registered panel's bottom sheet
 * on a touch one. Firna's menu rows take no address, so the cloud draws each
 * menu's list itself: one menu per group of rows, each row a menu item.
 * Docs and Changelog are links to the site, as the application draws them;
 * every other row leads to the drawing of what it opens, so a press in the
 * catalogue goes where the row goes in the product.
 */

/**
 * Where a popover opens in its layer: its end edge on the trigger's, at the
 * menu's width.
 */
const placement: ViewStyle = { top: 0, right: 0, width: 260 };

/**
 * One menu row: its glyph, its label, and where it leads: the catalogue
 * entry its action opens, or the page of the public site that it links.
 */
type DrawnRow = { id: string; label: string; glyph: ReactNode } & (
  { to: string; href?: undefined } | { href: string; to?: undefined }
);

/**
 * One menu: its rows, each with its glyph in a column of one width, so every
 * label starts at one edge. A popover marks the keyboard's row, the first as
 * it opens, with the library's ring; the sheet has no keyboard and marks
 * none.
 */
function Menu({
  label,
  rows,
  marked,
}: {
  label: string;
  rows: readonly DrawnRow[];
  marked?: string;
}) {
  return (
    <div className="fo-canvas-menu-list" role="menu" aria-label={label}>
      {rows.map((row) => {
        const className =
          "fo-canvas-menu-row" +
          (row.id === marked ? " fo-canvas-menu-row-marked" : "");
        const parts = (
          <>
            <span className="fo-canvas-menu-glyph">{row.glyph}</span>
            <span className="fo-canvas-menu-text">{row.label}</span>
          </>
        );
        return row.href === undefined ? (
          <MockLink
            key={row.id}
            className={className}
            to={row.to}
            role="menuitem"
          >
            {parts}
          </MockLink>
        ) : (
          <a key={row.id} className={className} href={row.href} role="menuitem">
            {parts}
          </a>
        );
      })}
    </div>
  );
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
 * The account menu's items. Docs and Changelog open the site, so each carries
 * the external glyph in place of a glyph of its own, and Settings stays the
 * first item.
 */
const accountItems: readonly DrawnRow[] = [
  {
    id: "settings",
    label: "Settings",
    glyph: <Icon name="settings" />,
    to: "product/settings/sections",
  },
  {
    id: "docs",
    label: "Docs",
    glyph: <Icon name="external" />,
    href: site.docs,
  },
  {
    id: "changelog",
    label: "Changelog",
    glyph: <Icon name="external" />,
    href: site.changelog,
  },
  {
    id: "sign-out",
    label: "Sign out",
    glyph: <Icon name="signOut" />,
    to: "product/account/sign-in",
  },
];

/**
 * The account rows that end both menus: who is signed in and the Theme
 * choice, then the menu's own items, Settings, Docs, Changelog and Sign out.
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
    <>
      <div className="fo-canvas-menu-head">
        <Identity />
        <ThemeChoice scheme={scheme} instance={instance} />
      </div>
      <Menu
        label="Account"
        rows={accountItems}
        marked={marked ? "settings" : undefined}
      />
    </>
  );
}

/**
 * More's own rows, above the account rows: the project, History and Share.
 * The package keeps its own search control in the compact bar, so More
 * carries no Search.
 */
function MoreRows({ marked }: { marked: boolean }) {
  return (
    <Menu
      label="More"
      marked={marked ? "project" : undefined}
      rows={[
        {
          id: "project",
          label: sample.workspace + " / " + sample.project,
          glyph: <Icon name="project" />,
          to: "product/viewer/projects",
        },
        {
          id: "history",
          label: "History",
          glyph: <Icon name="history" />,
          to: "product/viewer/history",
        },
        {
          id: "share",
          label: "Share",
          glyph: <ShareGlyph />,
          to: "product/viewer/share",
        },
      ]}
    />
  );
}

/** A popover in the package's surface chrome, named by its trigger's menu. */
function Popover({ label, children }: { label: string; children: ReactNode }) {
  const chrome = useDropdownSurfaceStyles();
  return (
    <View style={[chrome.surface, placement]}>
      <PopoverSurface label={label}>
        <div className="fo-canvas-menu-body">{children}</div>
      </PopoverSurface>
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
    <div className="fo-canvas-menu-body fo-canvas-menu-sheet">
      <MoreRows marked={false} />
      <span className="fo-canvas-menu-rule" />
      <AccountRows scheme={scheme} instance="more-sheet" marked={false} />
    </div>
  );
}
