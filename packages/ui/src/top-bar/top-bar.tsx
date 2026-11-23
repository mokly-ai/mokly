/**
 * The shell's 48px top bar, in three columns. The start column holds the
 * brand and a host's start slot; the centre column holds a host's centre
 * slot; the end column holds the catalogue search, the end control, and a
 * host's end slot. Search stays available at every width. Where the bar is
 * too narrow for the field, the search toggle opens a compact search over the
 * bar; the field then takes focus, and Escape or Close search returns focus
 * to the toggle. The bar has no menu, also in a static depiction: the dock's
 * Catalogue opens the catalogue's sheet.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

import { IconSvg, SearchIcon } from "../icons/icons.js";

import { Brand } from "./top-bar-links.js";

/**
 * The containers of an embedded root's top-bar host slots. The bar places
 * `start` after the brand, `center` in its centre column, and `end` after the
 * end control.
 */
export interface TopBarHost {
  start: ReactNode;
  center: ReactNode;
  end: ReactNode;
}

export function TopBar({
  brandHref,
  end,
  host,
  interactive = true,
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
  /**
   * Not read: the bar has no menu, whose catalogue state this named. It
   * stays so that a host that passes it still compiles.
   */
  drawerOpen?: boolean;
  /** The control at the end of the bar, such as the appearance selector. */
  end?: ReactNode;
  /**
   * The containers of an embedded root's host slots. A bar with host slots
   * draws the mark alone, because the host's start slot follows it.
   */
  host?: TopBarHost | undefined;
  /**
   * Whether the compact search draws its toggle and Close search, as it does
   * by default. A static depiction that runs no script sets `false`, which
   * leaves out the compact search controls and draws a brand without an
   * address as a picture of itself.
   */
  interactive?: boolean;
  /**
   * Not read: the bar has no menu, whose catalogue this named. It stays so
   * that a host that passes it still compiles.
   */
  navigationId?: string | undefined;
  /**
   * Not read: the bar has no menu, whose drawer state this received. It
   * stays so that a host that passes it still compiles.
   */
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
      className="mbk-topbar mbk-reset"
      data-compact-search={compactSearchOpen ? "open" : "closed"}
      data-search=""
    >
      <div className="mbk-topbar-start mbk-reset">
        <Brand
          href={brandHref ?? (interactive ? "/" : undefined)}
          wordmark={host === undefined}
        />
        {host?.start}
      </div>
      {host ? (
        <div className="mbk-topbar-center mbk-reset">{host.center}</div>
      ) : null}
      <div className="mbk-topbar-end mbk-reset">
        {/* The compact search opens this group over the whole bar. */}
        <div className="mbk-search-group mbk-reset">
          {interactive ? (
            <button
              aria-controls={searchId}
              aria-expanded={compactSearchOpen}
              aria-label="Search catalogue"
              className="mbk-search-toggle mbk-reset"
              onClick={() => setCompactSearchOpen(true)}
              ref={searchToggle}
              type="button"
            >
              <SearchIcon />
            </button>
          ) : null}
          <div className="mbk-search mbk-reset">
            <SearchIcon />
            <input
              aria-label="Search catalogue"
              className="mbk-reset"
              data-mokly-search=""
              id={searchId}
              onChange={(event) => onSearch?.(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setCompactSearchOpen(false);
              }}
              placeholder="Search"
              ref={searchInput}
              type="search"
              value={query}
            />
            {tagPicker}
          </div>
          {interactive ? (
            <button
              aria-label="Close search"
              className="mbk-search-close mbk-reset"
              onClick={() => setCompactSearchOpen(false)}
              type="button"
            >
              <IconSvg size={16}>
                <path d="m6 6 12 12M18 6 6 18" />
              </IconSvg>
            </button>
          ) : null}
        </div>
        {end}
        {host?.end}
      </div>
    </header>
  );
}
