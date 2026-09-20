// Renders the served Mokly left navigation as native disclosure elements.
// Pages and Components are independent top-level disclosures; each projects
// the same authored collection hierarchy down to its relevant entry kinds.
// The rows themselves — collection summaries, leaves, and the variant list a
// screen discloses — live in `nav_rows.tsx`.

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { ChevronIcon } from "./icons.js";
import { NavFilter, NavStatus } from "./nav_filter.js";
import { NavigationResizeHandle } from "./nav_resize.js";
import { NavRows } from "./nav_rows.js";
import { buildNavSections } from "./nav_tree.js";
import type { NavLeafNode, NavSectionNode } from "./nav_tree.js";

function SectionRows(props: {
  context: ShellContext;
  section: NavSectionNode;
}) {
  return (
    <details
      className="mbk-nav-section"
      data-nav-disclosure={props.section.key}
      data-nav-section={props.section.id}
      open
    >
      <summary className="mbk-nav-section-head">
        <span className="mbk-nav-section-chevron" aria-hidden="true">
          <ChevronIcon />
        </span>
        {props.section.label}
      </summary>
      <NavRows
        context={props.context}
        depth={0}
        nodes={props.section.children}
        sectionId={props.section.id}
      />
    </details>
  );
}

/** The served catalogue navigation column. */
export function CatalogueNav(props: {
  catalogue: Catalogue;
  context: ShellContext;
}) {
  const removedLeaves = props.catalogue.removedEntries.map(
    ({ entry }): NavLeafNode => ({
      kind: "leaf",
      key: `removed:${entry.route}`,
      entryId: entry.id,
      entryKind: entry.kind,
      label: `${entry.title} · Removed`,
      route: entry.route,
      tags: entry.tags ?? [],
      removedPage: entry.kind === "page",
    }),
  );
  const sections = buildNavSections(props.catalogue.hierarchy, removedLeaves);
  return (
    <nav
      aria-label="Catalogue"
      className="mbk-nav"
      data-mokly-nav=""
      id="mb-nav"
    >
      <div className="mbk-nav-head">
        Catalogue
        <button
          className="mbk-nav-collapse"
          data-mokly-collapse=""
          type="button"
        >
          Collapse all
        </button>
      </div>
      <NavFilter context={props.context} />
      <div className="mbk-nav-scroll" data-mokly-nav-scroll="">
        <NavStatus context={props.context} />
        {sections.map((section) => (
          <SectionRows
            context={props.context}
            key={section.key}
            section={section}
          />
        ))}
      </div>
      <NavigationResizeHandle />
    </nav>
  );
}
