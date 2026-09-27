import { useEffect, useRef, useState } from "react";

import type { StandaloneAppearanceState } from "../standalone/appearance_bridge.js";

import { AppearanceSelect } from "./appearance.js";
import type { Catalogue } from "./catalogue.js";
import { SchemeSwitch } from "./head.js";
import { BrandIcon, IconSvg, SearchIcon } from "./icons.js";
import { useShellIdentifier } from "./identifier_context.js";
import { useOptionalShellStore } from "./store_context.js";
import { SearchTagPicker } from "./tags.js";

/** The shared 48px catalogue header keeps search available at every width. */
export function TopBar(props: {
  appearance?: StandaloneAppearanceState;
  catalogue: Catalogue;
}) {
  const store = useOptionalShellStore();
  const navigationId = useShellIdentifier("mb-nav");
  const searchId = useShellIdentifier("mb-search");
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
        aria-expanded={store?.state.drawerOpen ?? false}
        aria-label="Open catalogue navigation"
        className="mbk-menu"
        data-mokly-menu=""
        onClick={() => store?.setDrawer(!store.state.drawerOpen)}
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
          onChange={(event) => store?.setSearch(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setCompactSearchOpen(false);
          }}
          placeholder="Search catalogue…"
          ref={searchInput}
          type="search"
          value={store?.state.query}
        />
        <SearchTagPicker tags={props.catalogue.tags} />
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
      {store?.context.embedded ? (
        props.catalogue.hasDarkFragments ? (
          <SchemeSwitch />
        ) : null
      ) : (
        <AppearanceSelect
          ready={props.appearance?.ready ?? false}
          theme={props.appearance?.theme ?? "auto"}
        />
      )}
    </header>
  );
}
