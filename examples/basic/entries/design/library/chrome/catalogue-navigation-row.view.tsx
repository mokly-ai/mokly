import type { CSSProperties } from "react";

import { MockLink } from "@mokly/mokly";

import type { DesignDestination } from "../../parts/destinations.js";
import {
  ChevronIcon,
  FlowIcon,
  FolderIcon,
  FolderOpenIcon,
  ScreenIcon,
  PageIcon,
  VariantIcon,
} from "../../parts/icons.js";

import type { NavigationRow } from "./catalogue-navigation-sections.js";

/** Left padding applied to a top-level (depth 0) row, in pixels. */
const ROOT_INSET = 8;
/** Horizontal distance between nesting levels, in pixels. */
const INDENT_STEP = 16;
/** X offset of a level's guide line, aligned under that level's icon. */
const GUIDE_OFFSET = 15;

function navRowStyle(depth: number): CSSProperties {
  const level = Math.max(depth, 0);
  const style: Record<string, number | string> = {
    "--mbk-indent": `${level * INDENT_STEP}px`,
    paddingLeft: ROOT_INSET + level * INDENT_STEP,
  };
  if (level === 0) {
    return style as CSSProperties;
  }
  const images: string[] = [];
  const positions: string[] = [];
  const sizes: string[] = [];
  for (let ancestor = 0; ancestor < level; ancestor += 1) {
    images.push("linear-gradient(var(--mbk-guide), var(--mbk-guide))");
    positions.push(`${GUIDE_OFFSET + ancestor * INDENT_STEP}px 0`);
    sizes.push("1px 100%");
  }
  style.backgroundImage = images.join(", ");
  style.backgroundPosition = positions.join(", ");
  style.backgroundSize = sizes.join(", ");
  style.backgroundRepeat = "no-repeat";
  return style as CSSProperties;
}

function RowIcon({ kind }: { kind: NavigationRow["kind"] }) {
  if (kind === "component") {
    return (
      <svg
        fill="none"
        stroke="currentColor"
        viewBox="0 0 16 16"
        width="15"
        height="15"
      >
        <path d="m8 1 6 3.5v7L8 15l-6-3.5v-7L8 1Zm0 7 6-3.5M8 8v7M8 8 2 4.5" />
      </svg>
    );
  }
  if (kind === "page") return <PageIcon />;
  if (kind === "flow") return <FlowIcon />;
  if (kind === "variant") return <VariantIcon />;
  return <ScreenIcon />;
}

/** The icon wrapper's modifier, which styles and tests target by row kind. */
function iconClassName(kind: NavigationRow["kind"]): string {
  if (kind === "flow") return "mbk-nav-ico flow";
  if (kind === "variant") return "mbk-nav-ico variant";
  return "mbk-nav-ico";
}

/**
 * The disclosure beside a screen that owns variants. It is a depiction: the
 * served shell toggles the list, so the mockup carries the state and the
 * accessible name without a destination.
 */
function VariantsToggle({ label, open }: { label: string; open: boolean }) {
  return (
    <button
      aria-expanded={open}
      aria-label={`${open ? "Hide" : "Show"} variants of ${label}`}
      className="mbk-nav-variants-toggle"
      type="button"
    >
      <ChevronIcon size={16} />
    </button>
  );
}

export function NavRow({
  activeDestination,
  activeLabel,
  node,
}: {
  activeDestination?: DesignDestination | undefined;
  activeLabel?: string | undefined;
  node: NavigationRow;
}) {
  const isActive =
    node.kind !== "folder" &&
    (activeDestination !== undefined
      ? node.to === activeDestination
      : activeLabel !== undefined && node.label === activeLabel);
  const className = isActive ? "mbk-nav-row active" : "mbk-nav-row";
  const mark = node.changed ? (
    <>
      <span className="mbk-nav-changed" aria-hidden="true" />
      <span className="mbk-nav-changed-text">Changed</span>
    </>
  ) : null;
  if (node.kind === "folder") {
    return (
      <span className={className} style={navRowStyle(node.depth)}>
        <span className="mbk-nav-ico folder" aria-hidden="true">
          {node.open ? <FolderOpenIcon /> : <FolderIcon />}
        </span>
        <span className="mbk-nav-label">{node.label}</span>
        {node.count !== undefined ? (
          <span className="mbk-nav-count">{node.count}</span>
        ) : null}
      </span>
    );
  }
  const content = (
    <>
      <span className={iconClassName(node.kind)} aria-hidden="true">
        <RowIcon kind={node.kind} />
      </span>
      {node.label}
      {mark}
    </>
  );
  const rowProps = {
    className,
    style: navRowStyle(node.depth),
    "aria-current": isActive ? ("page" as const) : undefined,
  };
  const row =
    node.to === undefined ? (
      <span {...rowProps}>{content}</span>
    ) : (
      <MockLink {...rowProps} to={node.to}>
        {content}
      </MockLink>
    );
  if (node.variants === undefined) return row;
  return (
    <div className="mbk-nav-leaf">
      {row}
      <VariantsToggle label={node.label} open={node.variants === "open"} />
    </div>
  );
}
