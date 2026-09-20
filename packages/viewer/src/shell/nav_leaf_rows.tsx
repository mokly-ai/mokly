// Leaf rows of the served catalogue tree: the entry-kind glyph, the row link
// every leaf and variant shares, and the variant list a screen discloses. A
// screen that owns variants keeps its link and gains a separate chevron
// button, because a row cannot be both a link and a `<summary>`.

import { catalogueViewHref } from "../navigation/delivery.js";

import type { ShellContext } from "./context.js";
import {
  ChevronIcon,
  FlowIcon,
  PageIcon,
  ScreenIcon,
  VariantIcon,
} from "./icons.js";
import {
  NAV_CHANGED_TEXT,
  NAV_CHANGED_TEXT_ATTRIBUTE,
  NAV_CHANGED_TEXT_CLASS,
} from "./nav_changed.js";
import { navRowStyle } from "./nav_guides.js";
import type { NavLeafNode, NavNode, NavSectionNode } from "./nav_tree.js";
import { WorkspaceIcon } from "./workspace_icons.js";

/** The persisted disclosure identity of one screen's variant list. */
function variantDisclosureKey(
  sectionId: NavSectionNode["id"],
  parentId: string,
): string {
  return `variants:${sectionId}:${parentId}`;
}

/** The element id the parent row's disclosure button controls. */
function variantListId(
  sectionId: NavSectionNode["id"],
  parentId: string,
): string {
  return `mb-nav-variants-${sectionId}-${parentId}`;
}

/** Whether a node, one of its descendants, or one of its variants is active. */
export function containsRoute(
  node: NavNode,
  route: string | undefined,
): boolean {
  if (route === undefined) {
    return false;
  }
  if (node.kind === "leaf") {
    return (
      node.route === route ||
      (node.variants ?? []).some((variant) => variant.route === route)
    );
  }
  return node.children.some((child) => containsRoute(child, route));
}

function LeafGlyph(props: {
  entryKind: NavLeafNode["entryKind"];
  variant: boolean;
}) {
  if (props.variant) {
    return (
      <span className="mbk-nav-ico variant">
        <VariantIcon />
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
  node: NavLeafNode;
  variant?: boolean;
}) {
  const active = props.node.route === props.context.activeRoute;
  const changed =
    props.context.changedRoutes?.includes(props.node.route) === true;
  const tags = props.node.tags ?? [];
  const changesOnly = props.node.removedPage || props.node.removedVariant;
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
      data-removed-variant={props.node.removedVariant ? "" : undefined}
      hidden={changesOnly ? true : undefined}
      data-route={props.node.route}
      data-tags={tags.length > 0 ? tags.join(" ") : undefined}
      href={catalogueViewHref(props.node.route)}
      style={navRowStyle(props.depth)}
    >
      <LeafGlyph
        entryKind={props.node.entryKind}
        variant={props.variant ?? false}
      />
      {props.node.label}
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
 * A leaf row. A screen that owns variants pairs its link with a chevron
 * button and is followed by the list that button discloses; the list is open
 * on the server only while the active route is the parent or one of them.
 */
export function LeafRow(props: {
  context: ShellContext;
  depth: number;
  node: NavLeafNode;
  sectionId: NavSectionNode["id"];
}) {
  const variants = props.node.variants ?? [];
  const parentId = props.node.entryId;
  const link = (
    <NavRowLink context={props.context} depth={props.depth} node={props.node} />
  );
  if (variants.length === 0 || parentId === undefined) {
    return link;
  }
  const listId = variantListId(props.sectionId, parentId);
  const open = containsRoute(props.node, props.context.activeRoute);
  return (
    <>
      <div className="mbk-nav-leaf">
        {link}
        <button
          aria-controls={listId}
          aria-expanded={open ? "true" : "false"}
          aria-label={`${open ? "Hide" : "Show"} variants of ${props.node.label}`}
          className="mbk-nav-variants-toggle"
          data-nav-variants-label={props.node.label}
          data-nav-variants-toggle={listId}
          type="button"
        >
          <ChevronIcon size={16} />
        </button>
      </div>
      <div
        className="mbk-nav-variants"
        data-nav-disclosure={variantDisclosureKey(props.sectionId, parentId)}
        data-nav-variants=""
        hidden={open ? undefined : true}
        id={listId}
      >
        {variants.map((variant) => (
          <NavRowLink
            context={props.context}
            depth={props.depth + 1}
            key={variant.key}
            node={variant}
            variant
          />
        ))}
      </div>
    </>
  );
}
