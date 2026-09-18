// Renders the served Mokly left navigation as native disclosure elements.
// Pages and Components are independent top-level disclosures; each projects
// the same authored collection hierarchy down to its relevant entry kinds.
// Collection summaries carry folder icons, leaves carry their entry-kind icon,
// and every row paints faint vertical guides (see `navRowStyle`).

import { catalogueViewHref } from "../navigation/delivery.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import {
  ChevronIcon,
  FlowIcon,
  FolderIcon,
  FolderOpenIcon,
  PageIcon,
  ScreenIcon,
} from "./icons.js";
import { NavFilter, NavStatus } from "./nav_filter.js";
import { navRowStyle } from "./nav_guides.js";
import { NavigationResizeHandle } from "./nav_resize.js";
import { buildNavSections } from "./nav_tree.js";
import type {
  NavGroupNode,
  NavLeafNode,
  NavNode,
  NavSectionNode,
} from "./nav_tree.js";
import { WorkspaceIcon } from "./workspace_icons.js";

function containsRoute(node: NavNode, route: string | undefined): boolean {
  if (route === undefined) {
    return false;
  }
  if (node.kind === "leaf") {
    return node.route === route;
  }
  return node.children.some((child) => containsRoute(child, route));
}

function LeafGlyph(props: { entryKind: NavLeafNode["entryKind"] }) {
  if (props.entryKind === "use-case") {
    return (
      <span className="mbk-nav-ico flow">
        <FlowIcon />
      </span>
    );
  }
  return (
    <span className="mbk-nav-ico">
      {props.entryKind === "component" ? (
        <WorkspaceIcon name="components" />
      ) : props.entryKind === "page" ? (
        <PageIcon />
      ) : (
        <ScreenIcon />
      )}
    </span>
  );
}

function LeafRow(props: {
  context: ShellContext;
  depth: number;
  node: NavLeafNode;
}) {
  const active = props.node.route === props.context.activeRoute;
  const changed =
    props.context.changedRoutes?.includes(props.node.route) === true;
  const tags = props.node.tags ?? [];
  return (
    <a
      aria-current={active ? "page" : undefined}
      className="mbk-nav-row"
      data-changed={changed ? "true" : undefined}
      data-entry-id={props.node.entryId}
      data-entry-kind={props.node.entryKind}
      data-nav-row=""
      data-nav-removed={props.node.key.startsWith("removed:") ? "" : undefined}
      data-removed-page={props.node.removedPage ? "" : undefined}
      hidden={props.node.removedPage ? true : undefined}
      data-route={props.node.route}
      data-tags={tags.length > 0 ? tags.join(" ") : undefined}
      href={catalogueViewHref(props.node.route)}
      style={navRowStyle(props.depth)}
    >
      <LeafGlyph entryKind={props.node.entryKind} />
      {props.node.label}
    </a>
  );
}

function GroupRow(props: {
  context: ShellContext;
  depth: number;
  node: NavGroupNode;
  sectionId: NavSectionNode["id"];
}) {
  const node = props.node;
  const open =
    props.depth === 0 || containsRoute(node, props.context.activeRoute);
  return (
    <details
      className="mbk-nav-group"
      data-nav-collection={node.key}
      data-nav-disclosure={collectionDisclosureKey(props.sectionId, node.key)}
      open={open ? true : undefined}
    >
      <summary className="mbk-nav-row" style={navRowStyle(props.depth)}>
        <span className="mbk-nav-ico folder">
          <FolderIcon />
          <FolderOpenIcon />
        </span>
        <span className="mbk-nav-label">{node.label}</span>
        {node.children.length > 0 ? (
          <span className="mbk-nav-count">{node.children.length}</span>
        ) : null}
      </summary>
      <NavRows
        context={props.context}
        depth={props.depth + 1}
        nodes={node.children}
        sectionId={props.sectionId}
      />
    </details>
  );
}

function NavRows(props: {
  context: ShellContext;
  depth: number;
  nodes: readonly NavNode[];
  sectionId: NavSectionNode["id"];
}) {
  return (
    <>
      {props.nodes.map((node) => {
        return node.kind === "group" ? (
          <GroupRow
            context={props.context}
            depth={props.depth}
            key={node.key}
            node={node}
            sectionId={props.sectionId}
          />
        ) : (
          <LeafRow
            context={props.context}
            depth={props.depth}
            key={node.key}
            node={node}
          />
        );
      })}
    </>
  );
}

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

function collectionDisclosureKey(
  sectionId: NavSectionNode["id"],
  collectionKey: string,
): string {
  const id = collectionKey.startsWith("collection:")
    ? collectionKey.slice("collection:".length)
    : collectionKey;
  return `collection:${sectionId}:${id}`;
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
