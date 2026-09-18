import type { Catalogue } from "./catalogue.js";
import { SchemeSwitch } from "./head.js";
import { BrandIcon, IconSvg, SearchIcon } from "./icons.js";
import { SearchTagPicker } from "./tags.js";

/** The shared 48px catalogue header keeps search available at every width. */
export function TopBar(props: { catalogue: Catalogue }) {
  return (
    <header className="mbk-topbar" data-search="">
      <button
        aria-controls="mb-nav"
        aria-expanded="false"
        aria-label="Open catalogue navigation"
        className="mbk-menu"
        data-mokly-menu=""
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
          placeholder="Search catalogue…"
          type="search"
        />
        <SearchTagPicker tags={props.catalogue.tags} />
      </div>
      {props.catalogue.hasDarkFragments ? <SchemeSwitch /> : null}
    </header>
  );
}
