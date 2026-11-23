/**
 * The shell's 48px top bar, in three columns. The start column holds the
 * brand and a host's start slot; the centre column holds a host's centre
 * slot; the end column holds the catalogue search, the end control, and a
 * host's end slot. Search stays available at every width. Where the bar is
 * too narrow for the field, the search toggle opens a compact search over the
 * bar; the field then takes focus, and Escape or Close search returns focus
 * to the toggle. A host moves focus to the field through the bar's handle,
 * which opens the compact search first where the field is hidden. The
 * field's key hint names the host's shortcut. The bar has no menu, also in a
 * static depiction: the dock's Catalogue opens the catalogue's sheet.
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
import { Brand } from "./top-bar-links.js";

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
  end,
  host,
  interactive = true,
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
   * Whether the bar's controls act, as they do by default. A static depiction
   * that runs no script sets `false`: the compact search's toggle is then a
   * native button without a handler, as the search field is a native field,
   * and Close search is left out, because a static search never opens. A
   * brand without an address is then a picture of itself.
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
          <button
            aria-controls={searchId}
            aria-expanded={interactive && compactSearchOpen}
            aria-label="Search catalogue"
            className="mbk-search-toggle mbk-reset"
            onClick={interactive ? () => setCompactSearchOpen(true) : undefined}
            ref={searchToggle}
            type="button"
          >
            <SearchIcon />
          </button>
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
