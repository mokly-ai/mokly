/** One catalogue row link, with its glyph, its indent, and its changed mark. */

import type { CSSProperties } from "react";

import {
  ComponentVariantIcon,
  DocumentIcon,
  FlowIcon,
  PageIcon,
  ScreenIcon,
  VariantIcon,
  WorkspaceIcon,
} from "../icons/icons.js";

import type { NavigationEntryKind, NavigationLink } from "./tree-records.js";

/** Left padding of a top-level (depth 0) row, in pixels. */
const ROOT_INSET = 8;
/** Horizontal distance between nesting levels, in pixels. */
const INDENT_STEP = 16;
/** X offset of a level's guide line, aligned under that level's folder icon. */
const GUIDE_OFFSET = 15;
/** One faint vertical guide line in the `--mbk-guide` colour. */
const GUIDE = "linear-gradient(var(--mbk-guide), var(--mbk-guide))";

/**
 * The inline style of a row at `depth`: its indent, the `--mbk-indent` offset
 * that insets the hover and current highlight to the row's content, and one
 * guide line for each ancestor level, so that rows at the same depth line up
 * along one continuous guide. A top-level row has no guide.
 */
export function rowStyle(depth: number): CSSProperties {
  const level = Math.max(depth, 0);
  const style: CSSProperties & { "--mbk-indent": string } = {
    paddingLeft: ROOT_INSET + level * INDENT_STEP,
    "--mbk-indent": `${level * INDENT_STEP}px`,
  };
  if (level === 0) return style;
  const ancestors = Array.from({ length: level }, (_, ancestor) => ancestor);
  return {
    ...style,
    backgroundImage: ancestors.map(() => GUIDE).join(", "),
    backgroundPosition: ancestors
      .map((ancestor) => `${GUIDE_OFFSET + ancestor * INDENT_STEP}px 0`)
      .join(", "),
    backgroundSize: ancestors.map(() => "1px 100%").join(", "),
    backgroundRepeat: "no-repeat",
  };
}

/** The glyph of a row: its entry kind, or a variant of a screen or component. */
function LinkGlyph({
  kind,
  variant,
}: {
  kind: NavigationEntryKind;
  variant: boolean;
}) {
  if (variant)
    return (
      <span className="mbk-nav-ico variant">
        {kind === "component" ? <ComponentVariantIcon /> : <VariantIcon />}
      </span>
    );
  if (kind === "use-case")
    return (
      <span className="mbk-nav-ico flow">
        <FlowIcon />
      </span>
    );
  return (
    <span className="mbk-nav-ico">
      {kind === "component" ? (
        <WorkspaceIcon name="components" />
      ) : kind === "page" ? (
        <PageIcon />
      ) : kind === "document" ? (
        <DocumentIcon />
      ) : (
        <ScreenIcon />
      )}
    </span>
  );
}

/**
 * One row link. The row always holds the changed mark's wording; the
 * stylesheet draws the mark from `data-changed` and `data-changed-variants`
 * and decides whether the wording reaches assistive technology, so a host
 * moves the mark by changing the attributes alone. `data-nav-changed-text`
 * names the wording, so that search can leave it out.
 */
export function RowLink({
  link,
  variant,
}: {
  link: NavigationLink;
  /** Whether the row is a variant in an entry's list. */
  variant: boolean;
}) {
  return (
    <a
      aria-current={link.current ? "page" : undefined}
      className="mbk-nav-row"
      data-changed={link.changed ? "true" : undefined}
      data-changed-variants={link.changedVariants ? "true" : undefined}
      data-entry-id={link.entry}
      data-entry-kind={link.kind}
      data-nav-index={link.index ? "" : undefined}
      data-nav-row=""
      data-nav-removed={link.removed ? "" : undefined}
      data-removed-page={link.removedPage ? "" : undefined}
      data-removed-variant={link.removedVariant ? "" : undefined}
      hidden={link.hidden}
      data-route={link.route}
      data-tags={link.tags.length > 0 ? link.tags.join(" ") : undefined}
      href={link.href}
      style={rowStyle(link.depth)}
    >
      <LinkGlyph kind={link.kind} variant={variant} />
      {link.label}
      <span className="mbk-nav-changed-text" data-nav-changed-text="">
        Changed
      </span>
    </a>
  );
}
