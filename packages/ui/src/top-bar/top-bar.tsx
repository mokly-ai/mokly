/**
 * The shell's 48px top bar: the menu that opens the catalogue drawer, the
 * brand, the catalogue search, and an end control. Search stays available at
 * every width. Where the bar is too narrow for the field, the search toggle
 * opens a compact search over the bar; the field then takes focus, and
 * Escape or Close search returns focus to the toggle.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

import { BrandIcon, IconSvg, SearchIcon } from "../icons/icons.js";

export function TopBar({
  drawerOpen,
  end,
  navigationId,
  onDrawer,
  onSearch,
  query,
  searchId,
  tagPicker,
}: {
  /** Whether the catalogue drawer is open, which the menu button reports. */
  drawerOpen: boolean;
  /** The control at the end of the bar, such as the appearance selector. */
  end?: ReactNode;
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
      <button
        aria-controls={navigationId}
        aria-expanded={drawerOpen}
        aria-label="Open catalogue navigation"
        className="mbk-menu"
        data-mokly-menu=""
        onClick={() => onDrawer?.(!drawerOpen)}
        type="button"
      >
        <IconSvg size={16}>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </IconSvg>
      </button>
      <a aria-label="Mokly" className="mbk-brand" href="/">
        <span aria-hidden="true" className="mbk-mark">
          <BrandIcon />
        </span>
        <span className="mbk-name">mokly.</span>
      </a>
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
      {end}
    </header>
  );
}
