/** Leaf rows and screen-variant disclosures for the React shell. */

import { catalogueViewHref } from "../navigation/delivery.js";

import type { ShellContext } from "./context.js";
import {
  ChevronIcon,
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
  navLeafVisible,
  navNodeVisible,
  navigationFiltering,
  variantDisclosureKey,
} from "./nav_model.js";
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
  hidden?: boolean;
  node: NavLeafNode;
  variant?: boolean;
}) {
  const store = useOptionalShellStore();
  const context = store?.context ?? props.context;
  const active = props.node.route === props.context.activeRoute;
  const changed = context.changedRoutes?.includes(props.node.route) === true;
  const changedVariants = (props.node.variants ?? []).some((variant) =>
    context.changedRoutes?.includes(variant.route),
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
      data-nav-row=""
      data-nav-removed={props.node.key.startsWith("removed:") ? "" : undefined}
      data-removed-page={props.node.removedPage ? "" : undefined}
      data-removed-variant={props.node.removedVariant ? "" : undefined}
      hidden={props.hidden}
      data-route={props.node.route}
      data-tags={tags.length > 0 ? tags.join(" ") : undefined}
      href={`${catalogueViewHref(props.node.route)}${
        props.node.snapshotId ? `?snapshot=${props.node.snapshotId}` : ""
      }`}
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
  const variants = props.node.variants ?? [];
  const parentId = props.node.entryId;
  const listId = useShellIdentifier(
    `mb-nav-variants-${props.sectionId}-${parentId ?? "unknown"}`,
  );
  const leafVisible = store
    ? navLeafVisible(props.node, store.state.selection, store.context)
    : !props.node.removedPage && !props.node.removedVariant;
  if (variants.length === 0 || parentId === undefined) {
    return (
      <NavRowLink
        context={props.context}
        depth={props.depth}
        hidden={!leafVisible}
        node={props.node}
      />
    );
  }
  const key = variantDisclosureKey(props.sectionId, parentId);
  const filtering = store ? navigationFiltering(store.state.selection) : false;
  const parentVisible = store
    ? navNodeVisible(props.node, store.state.selection, store.context)
    : true;
  const matchingVariants = store
    ? variants.filter((variant) =>
        navLeafVisible(variant, store.state.selection, store.context),
      )
    : variants.filter((variant) => !variant.removedVariant);
  const active =
    props.node.route === props.context.activeRoute ||
    variants.some((variant) => variant.route === props.context.activeRoute);
  const open = filtering
    ? matchingVariants.length > 0
    : (store?.state.disclosures[key] ?? active);
  const link = (
    <NavRowLink context={props.context} depth={props.depth} node={props.node} />
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
          onClick={() => store?.setDisclosure(key, !open)}
          type="button"
        >
          <ChevronIcon size={16} />
        </button>
      </div>
      <div
        className="mbk-nav-variants"
        data-filter-open={
          store?.state.filterBaseline
            ? store.state.filterBaseline[key]
              ? "1"
              : "0"
            : undefined
        }
        data-nav-disclosure={key}
        data-nav-variants=""
        hidden={open ? undefined : true}
        id={listId}
      >
        {variants.map((variant) => (
          <NavRowLink
            context={props.context}
            depth={props.depth + 1}
            hidden={
              store
                ? !navLeafVisible(variant, store.state.selection, store.context)
                : Boolean(variant.removedVariant)
            }
            key={variant.key}
            node={variant}
            variant
          />
        ))}
      </div>
    </>
  );
}
