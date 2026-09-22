/** Catalogue rail rendered from the shared hierarchy and live shell state. */

import type { CSSProperties } from "react";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { ChevronIcon } from "./icons.js";
import { useShellIdentifier } from "./identifier_context.js";
import { NavFilter, NavStatus } from "./nav_filter.js";
import {
  catalogueNavSections,
  navNodeVisible,
  navigationFiltering,
} from "./nav_model.js";
import { NavigationResizeHandle } from "./nav_resize.js";
import { NavRows } from "./nav_rows.js";
import { useNavigationScroll } from "./nav_scroll.js";
import type { NavSectionNode } from "./nav_tree.js";
import { useOptionalShellStore } from "./store_context.js";

function SectionRows({
  context,
  section,
}: {
  context: ShellContext;
  section: NavSectionNode;
}) {
  const store = useOptionalShellStore();
  const open = store?.state.disclosures[section.key] ?? true;
  const filtered = store ? navigationFiltering(store.state.selection) : false;
  const visible =
    !store ||
    section.children.some((node) =>
      navNodeVisible(node, store.state.selection, store.context),
    );
  return (
    <details
      className="mbk-nav-section"
      data-filter-open={
        store?.state.filterBaseline
          ? store.state.filterBaseline[section.key]
            ? "1"
            : "0"
          : undefined
      }
      data-nav-disclosure={section.key}
      data-nav-section={section.id}
      hidden={filtered && !visible}
      onToggle={(event) => {
        if (store?.interactive && event.currentTarget.open !== open)
          store.setDisclosure(section.key, event.currentTarget.open);
      }}
      open={open}
    >
      <summary className="mbk-nav-section-head">
        <span aria-hidden="true" className="mbk-nav-section-chevron">
          <ChevronIcon />
        </span>
        {section.label}
      </summary>
      <NavRows
        context={context}
        depth={0}
        nodes={section.children}
        sectionId={section.id}
      />
    </details>
  );
}

/** The served catalogue navigation column. */
export function CatalogueNav({
  catalogue,
  context,
}: {
  catalogue: Catalogue;
  context: ShellContext;
}) {
  const store = useOptionalShellStore();
  const navigationId = useShellIdentifier("mb-nav");
  const sections = store?.sections ?? catalogueNavSections(catalogue);
  const scroll = useNavigationScroll(store, store?.state.route);
  const changesStatus = context.changedRoutes ? "ready" : context.changesStatus;
  const waiting =
    store?.state.selection.view === "changes" &&
    (changesStatus === "pending" || changesStatus === "preparing");
  const style = store?.interactive
    ? ({
        "--mbk-nav-width": `${store.state.navigationWidth}px`,
      } as CSSProperties)
    : undefined;
  return (
    <nav
      aria-label="Catalogue"
      className="mbk-nav"
      data-mokly-nav=""
      data-resize-ready={store?.interactive ? "" : undefined}
      id={navigationId}
      style={style}
    >
      <div className="mbk-nav-head">
        Catalogue
        <button
          className="mbk-nav-collapse"
          data-mokly-collapse=""
          onClick={() => store?.collapseAll()}
          type="button"
        >
          Collapse all
        </button>
      </div>
      <NavFilter context={context} />
      <div
        aria-busy={waiting}
        className="mbk-nav-scroll"
        data-mokly-nav-scroll=""
        onScroll={(event) => store?.setNavScroll(event.currentTarget.scrollTop)}
        ref={scroll}
      >
        <NavStatus context={context} />
        {sections.map((section) => (
          <SectionRows context={context} key={section.key} section={section} />
        ))}
      </div>
      <NavigationResizeHandle />
    </nav>
  );
}
