/**
 * The depicted Mokly viewer of the Browse and Changes frames, opened on
 * acme/storefront's branch `feat/checkout-v2`: the bar with the crumb, the
 * branch, the pull request, the commit, the people in the file, History and
 * Share, then the catalogue column with the open screen's row current, and
 * the open screen as each frame draws it: on its canvas in Browse, in its
 * compare in Changes. On a phone the bar keeps the mark, the branch and
 * Share, and the catalogue column stacks with the screen. The viewer is a
 * depiction, so its controls are text.
 */

import type { ReactNode } from "react";

import { MoklyMark } from "../parts/brand.js";
import { SiteIcon } from "../parts/icons.js";
import { SitePresence } from "../parts/people.js";

import { ViewerTree, type ViewerScreen } from "./viewer-tree.js";

/** The parts of the bar that only the desktop composition has room for. */
function BarDetails() {
  return (
    <>
      <span className="site-crumbs">
        <span className="site-crumb">acme</span>
        <span className="site-crumb">
          <span className="site-crumb-sep">/</span>
          storefront
        </span>
      </span>
      <BranchChip />
      <span className="site-home-viewer-pr">
        <SiteIcon name="pullRequest" size={14} />
        #482
      </span>
      <span className="site-home-viewer-commit">9c2f5ae</span>
      {/* status: "ahead" (presence) */}
      <SitePresence
        className="site-home-viewer-people"
        people={["maya", "sam"]}
      />
      <span className="site-home-viewer-button">
        <SiteIcon name="history" size={15} />
        History
      </span>
    </>
  );
}

/** The branch chip with its menu chevron. */
function BranchChip() {
  return (
    <span className="site-home-viewer-branch">
      <SiteIcon name="branch" size={14} />
      feat/checkout-v2
      <SiteIcon name="chevronDown" size={12} />
    </span>
  );
}

/**
 * The depicted viewer window, with `current` open: `children` draws the
 * open screen beside the catalogue column.
 */
export function Viewer({
  children,
  current,
  viewport,
}: {
  children: ReactNode;
  current: ViewerScreen;
  viewport: "mobile" | "desktop";
}) {
  return (
    <div aria-hidden="true" className="site-frame">
      <div className="site-topbar">
        <span className="site-topbar-mark">
          <MoklyMark size={24} />
        </span>
        {viewport === "desktop" ? <BarDetails /> : <BranchChip />}
        <span className="site-home-viewer-button site-home-viewer-share">
          Share
        </span>
      </div>
      <div className="site-shell-body">
        <ViewerTree current={current} />
        {children}
      </div>
    </div>
  );
}
