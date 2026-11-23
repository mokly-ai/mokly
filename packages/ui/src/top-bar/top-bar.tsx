/**
 * The shell's 48px top bar, in three columns. The start column holds the menu
 * that opens the catalogue drawer, the brand, and a host's start slot; the
 * centre column holds a host's centre slot; the end column holds the catalogue
 * search, the end control, and a host's end slot. Search stays available at
 * every width. Where the bar is too narrow for the field, the search toggle
 * opens a compact search over the bar; the field then takes focus, and Escape
 * or Close search returns focus to the toggle. A host moves focus to the
 * field through the bar's handle, which opens the compact search first where
 * the field is hidden. The field's key hint names the host's shortcut.
 */

import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";

import { IconSvg, SearchIcon } from "../icons/icons.js";

import { SearchHint, type SearchShortcut } from "./search-hint.js";
import { Brand, Menu } from "./top-bar-links.js";

export type { SearchShortcut } from "./search-hint.js";

/**
 * The shortcuts that move focus to the search field, which the field of an
 * interactive bar names to assistive technology. Its host binds them.
 */
const SEARCH_SHORTCUTS = "Control+K Meta+K /";

/** What a host can ask of the top bar that it renders. */
export interface TopBarHandle {
  /**
   * Move focus to the search field. Where the compact search hides the field,
   * the compact search opens, and its field takes focus.
   */
  focusSearch(): void;
}

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
  drawerOpen,
  end,
  host,
  interactive = true,
  menuHref,
  navigationId,
  onDrawer,
  onSearch,
  query,
  ref,
  searchId,
  searchShortcut = "command",
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
   * The containers of an embedded root's host slots. A bar with host slots
   * draws the mark alone, because the host's start slot follows it.
   */
  host?: TopBarHost | undefined;
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
  /** Receives the handle through which the host moves focus to the search. */
  ref?: Ref<TopBarHandle> | undefined;
  /** The id of the search field, unique in the document. */
  searchId: string;
  /**
   * The shortcut that the search field's key hint names: `command`, the
   * default, names `⌘K` and `control` names `Ctrl K`.
   */
  searchShortcut?: SearchShortcut | undefined;
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
  useImperativeHandle(
    ref,
    () => ({
      focusSearch() {
        const input = searchInput.current;
        if (!input) return;
        input.focus();
        // A hidden field takes no focus. The compact search then opens, and
        // the effect above focuses its field once it shows.
        if (!input.matches(":focus")) setCompactSearchOpen(true);
      },
    }),
    [],
  );
  return (
    <header
      className="mbk-topbar mbk-reset"
      data-compact-search={compactSearchOpen ? "open" : "closed"}
      data-search=""
    >
      <div className="mbk-topbar-start mbk-reset">
        <Menu
          drawerOpen={drawerOpen}
          href={menuHref}
          interactive={interactive}
          navigationId={navigationId}
          onDrawer={onDrawer}
        />
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
              aria-keyshortcuts={interactive ? SEARCH_SHORTCUTS : undefined}
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
            <SearchHint shortcut={searchShortcut} />
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
