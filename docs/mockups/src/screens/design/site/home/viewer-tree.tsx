/**
 * The catalogue column of the depicted Mokly viewer: the All and Changes
 * filter with All chosen, then the Specs and Components sections of the
 * acme/storefront catalogue, with the open screen's row current and a dot
 * on each changed or added entry. The Changes frame opens checkout/payment
 * and the Browse frame opens pricing.
 */

import { SiteIcon, type SiteIconName } from "../parts/icons.js";

/** A screen that a depicted viewer opens. */
export type ViewerScreen = "payment" | "pricing";

/** One row of the depicted tree. */
interface TreeRow {
  change?: "added" | "changed";
  /** 0 for a folder or a root entry, 1 inside a folder, 2 for a variant. */
  depth: 0 | 1 | 2;
  icon?: SiteIconName;
  label: string;
  /** A folder, drawn with its open chevron. */
  open?: boolean;
}

const SECTIONS: ReadonlyArray<{ rows: readonly TreeRow[]; title: string }> = [
  {
    rows: [
      { depth: 0, label: "checkout", open: true },
      { change: "changed", depth: 1, icon: "screen", label: "payment" },
      { change: "added", depth: 1, icon: "screen", label: "review-order" },
      { depth: 0, label: "onboarding", open: true },
      { depth: 1, icon: "screen", label: "welcome" },
      { depth: 0, label: "account", open: true },
      { change: "changed", depth: 1, icon: "screen", label: "settings" },
      { change: "changed", depth: 0, icon: "screen", label: "pricing" },
    ],
    title: "Specs",
  },
  {
    rows: [
      { depth: 0, icon: "component", label: "Button", open: true },
      { depth: 2, label: "Primary" },
      { depth: 2, label: "Secondary" },
      { depth: 2, label: "Danger" },
      { depth: 0, icon: "component", label: "PriceCard" },
      { depth: 0, icon: "component", label: "Avatar" },
    ],
    title: "Components",
  },
];

function Row({ current, row }: { current: boolean; row: TreeRow }) {
  const classes = ["site-row"];
  if (row.open) classes.push("site-row--group");
  if (current) classes.push("site-row--current");
  return (
    <span className={classes.join(" ")} data-site-depth={row.depth}>
      {row.open ? (
        <span className="site-tree-chevron">
          <SiteIcon name="chevronDown" size={12} />
        </span>
      ) : null}
      {row.icon === undefined ? null : (
        <span className="site-row-ico">
          <SiteIcon name={row.icon} size={13} />
        </span>
      )}
      <span className="site-row-label">{row.label}</span>
      {row.change === undefined ? null : (
        <span className={`site-home-dot site-home-dot--${row.change}`} />
      )}
    </span>
  );
}

/** The viewer's catalogue column, with the row of `current` current. */
export function ViewerTree({ current }: { current: ViewerScreen }) {
  return (
    <div className="site-tree">
      <span className="site-filter">
        <span className="site-filter-option site-filter-option--current">
          All
        </span>
        <span className="site-filter-option">
          Changes <span className="site-filter-count">4</span>
        </span>
      </span>
      <div className="site-tree-scroll">
        {SECTIONS.map((section) => (
          <div className="site-tree-section" key={section.title}>
            <p className="site-tree-section-head">{section.title}</p>
            {section.rows.map((row) => (
              <Row
                current={row.label === current}
                key={`${section.title}-${row.label}`}
                row={row}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
