/**
 * The shell's 48px top bar: the menu that opens the catalogue drawer, the
 * brand, the catalogue search, and an end control. Search stays available at
 * every width. Where the bar is too narrow for the field, the search toggle
 * opens a compact search over the bar; the field then takes focus, and
 * Escape or Close search returns focus to the toggle.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

import { IconSvg, SearchIcon } from "../icons/icons.js";

import { Brand, Menu } from "./top-bar-links.js";

export function TopBar({
  brandHref,
  drawerOpen,
  end,
  interactive = true,
  menuHref,
  navigationId,
  onDrawer,
  onSearch,
  query,
  searchId,
  tagPicker,
}: {
  /**
   * The address of the brand link, `/` by default. A bar that is not
   * interactive draws a brand without an address as a picture of itself.
   */
  brandHref?: string | undefined;
  /** Whether the catalogue drawer is open, which the menu button reports. */
  drawerOpen: boolean;
  /** The control at the end of the bar, such as the appearance selector. */
  end?: ReactNode;
  /**
   * Whether a menu without an address is a button and the compact search
   * draws its toggle and Close search, as they do by default. A static
   * depiction that runs no script sets `false`, which draws such a menu as a
   * picture of itself and leaves out the compact search controls.
   */
  interactive?: boolean;
  /**
   * The address that the menu opens, such as another document that shows the
   * drawer opened or closed. A menu with an address is a link whose name says
   * whether it opens or closes the drawer.
   */
  menuHref?: string | undefined;
  /** The id of the catalogue navigation that the menu button opens. */
  navigationId: string;
  /** Receives the drawer state that the menu button asks for. */
  onDrawer?: ((open: boolean) => void) | undefined;
  /** Receives each search text that the reader types. */
  onSearch?: ((query: string) => void) | undefined;
  /** The search text. Without it, the field keeps its own text. */
  query?: string | undefined;
  /** The id of the search field, unique in the document. */
  searchId: string;
  /** The control at the end of the search field, such as a tag picker. */
  tagPicker?: ReactNode;
}) {
  const [compactSearchOpen, setCompactSearchOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const searchToggle = useRef<HTMLButtonElement>(null);
  const searchWasOpen = useRef(false);
  useEffect(() => {
    if (compactSearchOpen) searchInput.current?.focus();
    else if (searchWasOpen.current) searchToggle.current?.focus();
    searchWasOpen.current = compactSearchOpen;
  }, [compactSearchOpen]);
  return (
    <header
      className="mbk-topbar"
      data-compact-search={compactSearchOpen ? "open" : "closed"}
      data-search=""
    >
      <Menu
        drawerOpen={drawerOpen}
        href={menuHref}
        interactive={interactive}
        navigationId={navigationId}
        onDrawer={onDrawer}
      />
      <Brand href={brandHref ?? (interactive ? "/" : undefined)} />
      {interactive ? (
        <button
          aria-controls={searchId}
          aria-expanded={compactSearchOpen}
          aria-label="Search catalogue"
          className="mbk-search-toggle"
          onClick={() => setCompactSearchOpen(true)}
          ref={searchToggle}
          type="button"
        >
          <SearchIcon />
        </button>
      ) : null}
      <div className="mbk-search">
        <SearchIcon />
        <input
          aria-label="Search catalogue"
          data-mokly-search=""
          id={searchId}
          onChange={(event) => onSearch?.(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setCompactSearchOpen(false);
          }}
          placeholder="Search catalogue…"
          ref={searchInput}
          type="search"
          value={query}
        />
        {tagPicker}
      </div>
      {interactive ? (
        <button
          aria-label="Close search"
          className="mbk-search-close"
          onClick={() => setCompactSearchOpen(false)}
          type="button"
        >
          <IconSvg size={16}>
            <path d="m6 6 12 12M18 6 6 18" />
          </IconSvg>
        </button>
      ) : null}
      {end}
    </header>
  );
}
