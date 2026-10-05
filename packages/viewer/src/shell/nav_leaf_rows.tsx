/** Leaf rows and entry-variant disclosures for the React shell. */

import type { ReactNode } from "react";

import { entryRoute, viewHref } from "../navigation/routes.js";

import type { ShellContext } from "./context.js";
import {
  ChevronIcon,
  ComponentVariantIcon,
  DocumentIcon,
  FlowIcon,
  PageIcon,
  ScreenIcon,
  VariantIcon,
} from "./icons.js";
import { useShellIdentifier } from "./identifier_context.js";
import {
  NAV_CHANGED_TEXT,
  NAV_CHANGED_TEXT_ATTRIBUTE,
  NAV_CHANGED_TEXT_CLASS,
} from "./nav_changed.js";
import { navRowStyle } from "./nav_guides.js";
import {
  navDisclosureOpen,
  navLeafVisible,
  navNodeContains,
  navNodeVisible,
  UNFILTERED_SELECTION,
  variantDisclosureKey,
} from "./nav_model.js";
import { navRowPresentation } from "./nav_moves.js";
import type { NavLeafNode, NavSectionNode } from "./nav_tree.js";
import { useOptionalShellStore } from "./store_context.js";
import { WorkspaceIcon } from "./workspace_icons.js";

function LeafGlyph(props: {
  entryKind: NavLeafNode["entryKind"];
  variant: boolean;
}) {
  if (props.variant) {
    return (
      <span className="mbk-nav-ico variant">
        {props.entryKind === "component" ? (
          <ComponentVariantIcon />
        ) : (
          <VariantIcon />
        )}
      </span>
    );
  }
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
      ) : props.entryKind === "document" ? (
        <DocumentIcon />
      ) : (
        <ScreenIcon />
      )}
    </span>
  );
}

/** One catalogue row link, used for leaves and for the variants they hold. */
function NavRowLink(props: {
  context: ShellContext;
  depth: number;
  hidden?: boolean;
  node: NavLeafNode;
  variant?: boolean;
}) {
  const store = useOptionalShellStore();
  const context = store?.context ?? props.context;
  const active = props.node.entryId === props.context.activeId;
  const { changed, changedVariants, label } = navRowPresentation(
    props.node,
    store?.state.selection.view === "changes",
    context,
  );
  const tags = props.node.tags ?? [];
  return (
    <a
      aria-current={active ? "page" : undefined}
      className="mbk-nav-row"
      data-changed={changed ? "true" : undefined}
      data-changed-variants={changedVariants ? "true" : undefined}
      data-entry-id={props.node.entryId}
      data-entry-kind={props.node.entryKind}
      data-nav-index={props.node.index ? "" : undefined}
      data-nav-row=""
      data-nav-removed={props.node.key.startsWith("removed:") ? "" : undefined}
      data-removed-page={props.node.removedPage ? "" : undefined}
      data-removed-variant={props.node.removedVariant ? "" : undefined}
      hidden={props.hidden}
      data-route={entryRoute(props.node.entryId)}
      data-tags={tags.length > 0 ? tags.join(" ") : undefined}
      href={`${viewHref(props.node.entryId)}${
        props.node.snapshotId ? `?snapshot=${props.node.snapshotId}` : ""
      }`}
      style={navRowStyle(props.depth)}
    >
      <LeafGlyph
        entryKind={props.node.entryKind}
        variant={props.variant ?? false}
      />
      {label}
      <span
        className={NAV_CHANGED_TEXT_CLASS}
        {...{ [NAV_CHANGED_TEXT_ATTRIBUTE]: "" }}
      >
        {NAV_CHANGED_TEXT}
      </span>
    </a>
  );
}

/**
 * A leaf row. An entry that owns variants, or a folder's own screen or
 * component with other members, pairs its link with a chevron button and is
 * followed by the list that button discloses: the variants, then the members
 * rendered by `children`. The list is open on the server only while it holds
 * the active route or the active route is the parent itself.
 */
export function LeafRow(props: {
  children?: ReactNode;
  context: ShellContext;
  depth: number;
  node: NavLeafNode;
  sectionId: NavSectionNode["id"];
}) {
  const store = useOptionalShellStore();
  const variants = props.node.variants ?? [];
  const members = props.node.members ?? [];
  const parentId = props.node.entryId;
  const listId = useShellIdentifier(
    `mb-nav-variants-${props.sectionId}-${parentId ?? "unknown"}`,
  );
  const selection = store?.state.selection ?? UNFILTERED_SELECTION;
  const context = store?.context ?? props.context;
  const leafVisible = navLeafVisible(props.node, selection, context);
  if ((variants.length === 0 && members.length === 0) || !parentId) {
    return (
      <NavRowLink
        context={props.context}
        depth={props.depth}
        hidden={!leafVisible}
        node={props.node}
      />
    );
  }
  const key = variantDisclosureKey(parentId);
  const parentVisible = navNodeVisible(props.node, selection, context);
  const listMatches =
    variants.some((variant) => navLeafVisible(variant, selection, context)) ||
    members.some((member) => navNodeVisible(member, selection, context));
  const active = navNodeContains(props.node, props.context.activeId);
  const open = navDisclosureOpen(
    store?.state.disclosures[key],
    active,
    listMatches,
  );
  const noun = members.length > 0 ? "contents" : "variants";
  const link = (
    <NavRowLink context={props.context} depth={props.depth} node={props.node} />
  );
  return (
    <>
      <div className="mbk-nav-leaf" hidden={!parentVisible}>
        {link}
        {listMatches ? (
          <button
            aria-controls={listId}
            aria-expanded={open ? "true" : "false"}
            aria-label={`${open ? "Hide" : "Show"} ${noun} of ${props.node.title}`}
            className="mbk-nav-variants-toggle"
            data-nav-variants-label={props.node.title}
            data-nav-variants-noun={noun}
            data-nav-variants-toggle={listId}
            onClick={() => store?.setDisclosure(key, !open)}
            type="button"
          >
            <ChevronIcon size={16} />
          </button>
        ) : null}
      </div>
      <div
        className="mbk-nav-variants"
        data-nav-has-rows={String(listMatches)}
        data-nav-saved-open={String(store?.state.disclosures[key] ?? active)}
        data-filter-open={
          store?.state.filterBaseline
            ? store.state.filterBaseline[key]
              ? "1"
              : "0"
            : undefined
        }
        data-nav-disclosure={key}
        data-nav-variants=""
        hidden={open && parentVisible ? undefined : true}
        id={listId}
      >
        {variants.map((variant) => (
          <NavRowLink
            context={props.context}
            depth={props.depth + 1}
            hidden={
              store
                ? !navLeafVisible(variant, store.state.selection, store.context)
                : Boolean(variant.removedVariant || variant.hidden)
            }
            key={variant.key}
            node={variant}
            variant
          />
        ))}
        {props.children}
      </div>
    </>
  );
}
