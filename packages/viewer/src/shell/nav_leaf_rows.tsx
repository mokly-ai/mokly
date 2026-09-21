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
import { useShellIdentifierScope } from "./identifier_context.js";
import { navActivation } from "./nav_activation.js";
import {
  NAV_CHANGED_TEXT,
  NAV_CHANGED_TEXT_ATTRIBUTE,
  NAV_CHANGED_TEXT_CLASS,
} from "./nav_changed.js";
import { navRowStyle } from "./nav_guides.js";
import { navLeafVisible } from "./nav_model.js";
import type { NavLeafNode, NavNode, NavSectionNode } from "./nav_tree.js";
import { useOptionalShellStore } from "./store_context.js";
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
  aggregateChanged?: boolean;
  context: ShellContext;
  depth: number;
  hidden?: boolean;
  node: NavLeafNode;
  variant?: boolean;
}) {
  const store = useOptionalShellStore();
  const context = store?.context ?? props.context;
  const active = props.node.route === context.activeRoute;
  const changed = context.changedRoutes?.includes(props.node.route) === true;
  const tags = props.node.tags ?? [];
  const changesOnly = props.node.removedPage || props.node.removedVariant;
  const hidden =
    props.hidden ??
    (store
      ? !navLeafVisible(props.node, store.state.selection, context)
      : changesOnly);
  const activation = store
    ? navActivation(props.node, store.catalogue, context, store.state.selection)
    : { route: props.node.route };
  return (
    <a
      aria-current={active ? "page" : undefined}
      className="mbk-nav-row"
      data-changed={changed ? "true" : undefined}
      data-changed-variants={props.aggregateChanged ? "true" : undefined}
      data-entry-id={props.node.entryId}
      data-entry-kind={props.node.entryKind}
      data-nav-activate-scheme={activation.colorScheme}
      data-nav-activate-viewport={activation.viewport}
      data-nav-row=""
      data-nav-removed={props.node.key.startsWith("removed:") ? "" : undefined}
      data-removed-page={props.node.removedPage ? "" : undefined}
      data-removed-variant={props.node.removedVariant ? "" : undefined}
      hidden={hidden}
      data-route={props.node.route}
      data-tags={tags.length > 0 ? tags.join(" ") : undefined}
      href={catalogueViewHref(activation.route)}
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
  const store = useOptionalShellStore();
  const identifier = useShellIdentifierScope();
  const variants = props.node.variants ?? [];
  const parentId = props.node.entryId;
  if (variants.length === 0 || parentId === undefined) {
    return (
      <NavRowLink
        context={props.context}
        depth={props.depth}
        node={props.node}
      />
    );
  }
  const context = store?.context ?? props.context;
  const disclosureKey = variantDisclosureKey(props.sectionId, parentId);
  const listId = identifier(variantListId(props.sectionId, parentId));
  const open =
    store?.state.disclosures[disclosureKey] ??
    containsRoute(props.node, context.activeRoute);
  const parentVisible = store
    ? navLeafVisible(props.node, store.state.selection, context) ||
      variants.some((variant) =>
        navLeafVisible(variant, store.state.selection, context),
      )
    : true;
  const aggregateChanged = variants.some((variant) =>
    context.changedRoutes?.includes(variant.route),
  );
  const link = (
    <NavRowLink
      aggregateChanged={aggregateChanged}
      context={context}
      depth={props.depth}
      hidden={false}
      node={props.node}
    />
  );
  return (
    <>
      <div className="mbk-nav-leaf" hidden={!parentVisible}>
        {link}
        <button
          aria-controls={listId}
          aria-expanded={open ? "true" : "false"}
          aria-label={`${open ? "Hide" : "Show"} variants of ${props.node.label}`}
          className="mbk-nav-variants-toggle"
          data-nav-variants-label={props.node.label}
          data-nav-variants-toggle={listId}
          onClick={() => store?.setDisclosure(disclosureKey, !open)}
          type="button"
        >
          <ChevronIcon size={16} />
        </button>
      </div>
      <div
        className="mbk-nav-variants"
        data-nav-disclosure={disclosureKey}
        data-nav-variants=""
        hidden={!open || !parentVisible}
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
