/** Catalogue rail rendered from the shared hierarchy and live shell state. */

import type { CSSProperties } from "react";

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
import {
  catalogueNavSections,
  navLeafVisible,
  navNodeVisible,
  navigationFiltering,
} from "./nav_model.js";
import { NavigationResizeHandle } from "./nav_resize.js";
import { useNavigationScroll } from "./nav_scroll.js";
import type {
  NavGroupNode,
  NavLeafNode,
  NavNode,
  NavSectionNode,
} from "./nav_tree.js";
import { useOptionalShellStore } from "./store_context.js";
import { WorkspaceIcon } from "./workspace_icons.js";

function LeafGlyph({ entryKind }: { entryKind: NavLeafNode["entryKind"] }) {
  if (entryKind === "use-case")
    return (
      <span className="mbk-nav-ico flow">
        <FlowIcon />
      </span>
    );
  return (
    <span className="mbk-nav-ico">
      {entryKind === "component" ? (
        <WorkspaceIcon name="components" />
      ) : entryKind === "page" ? (
        <PageIcon />
      ) : (
        <ScreenIcon />
      )}
    </span>
  );
}

function LeafRow({
  context,
  depth,
  node,
}: {
  context: ShellContext;
  depth: number;
  node: NavLeafNode;
}) {
  const store = useOptionalShellStore();
  const tags = node.tags ?? [];
  const hidden = store
    ? !navLeafVisible(node, store.state.selection, store.context)
    : node.removedPage;
  return (
    <a
      aria-current={node.route === context.activeRoute ? "page" : undefined}
      className="mbk-nav-row"
      data-changed={
        context.changedRoutes?.includes(node.route) ? "true" : undefined
      }
      data-entry-id={node.entryId}
      data-entry-kind={node.entryKind}
      data-nav-row=""
      data-nav-removed={node.key.startsWith("removed:") ? "" : undefined}
      data-removed-page={node.removedPage ? "" : undefined}
      data-route={node.route}
      data-tags={tags.length ? tags.join(" ") : undefined}
      hidden={hidden}
      href={catalogueViewHref(node.route)}
      style={navRowStyle(depth)}
    >
      <LeafGlyph entryKind={node.entryKind} />
      {node.label}
    </a>
  );
}

function GroupRow({
  context,
  depth,
  node,
  sectionId,
}: {
  context: ShellContext;
  depth: number;
  node: NavGroupNode;
  sectionId: NavSectionNode["id"];
}) {
  const store = useOptionalShellStore();
  const key = collectionDisclosureKey(sectionId, node.key);
  const open = store?.state.disclosures[key] ?? depth === 0;
  const filtered = store ? navigationFiltering(store.state.selection) : false;
  const hidden = store
    ? !navNodeVisible(node, store.state.selection, store.context)
    : false;
  return (
    <details
      className="mbk-nav-group"
      data-filter-open={
        store?.state.filterBaseline
          ? store.state.filterBaseline[key]
            ? "1"
            : "0"
          : undefined
      }
      data-nav-collection={node.key}
      data-nav-disclosure={key}
      hidden={filtered && hidden}
      onToggle={(event) => {
        if (store?.interactive && event.currentTarget.open !== open)
          store.setDisclosure(key, event.currentTarget.open);
      }}
      open={open}
    >
      <summary className="mbk-nav-row" style={navRowStyle(depth)}>
        <span className="mbk-nav-ico folder">
          <FolderIcon />
          <FolderOpenIcon />
        </span>
        <span className="mbk-nav-label">{node.label}</span>
        {node.children.length ? (
          <span className="mbk-nav-count">{node.children.length}</span>
        ) : null}
      </summary>
      <NavRows
        context={context}
        depth={depth + 1}
        nodes={node.children}
        sectionId={sectionId}
      />
    </details>
  );
}

function NavRows({
  context,
  depth,
  nodes,
  sectionId,
}: {
  context: ShellContext;
  depth: number;
  nodes: readonly NavNode[];
  sectionId: NavSectionNode["id"];
}) {
  return (
    <>
      {nodes.map((node) =>
        node.kind === "group" ? (
          <GroupRow
            context={context}
            depth={depth}
            key={node.key}
            node={node}
            sectionId={sectionId}
          />
        ) : (
          <LeafRow context={context} depth={depth} key={node.key} node={node} />
        ),
      )}
    </>
  );
}

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
  const sections = store?.sections ?? catalogueNavSections(catalogue);
  const scroll = useNavigationScroll(store, context.activeRoute);
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
      id="mb-nav"
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

function collectionDisclosureKey(
  sectionId: NavSectionNode["id"],
  collectionKey: string,
): string {
  const id = collectionKey.startsWith("collection:")
    ? collectionKey.slice("collection:".length)
    : collectionKey;
  return `collection:${sectionId}:${id}`;
}
