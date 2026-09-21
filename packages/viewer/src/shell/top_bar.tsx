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
  return (
    <header className="mbk-topbar" data-search="">
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
        <span className="mbk-name">Mokly</span>
      </a>
      <div className="mbk-search">
        <SearchIcon />
        <input
          aria-label="Search catalogue"
          data-mokly-search=""
          onChange={(event) => store?.setSearch(event.currentTarget.value)}
          placeholder="Search catalogue…"
          type="search"
          value={store?.state.query}
        />
        <SearchTagPicker tags={props.catalogue.tags} />
      </div>
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
