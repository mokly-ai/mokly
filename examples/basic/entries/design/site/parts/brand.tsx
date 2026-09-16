import { MockLink } from "@mokly/mokly";

import { SITE_SCREENS, type SiteScreen, currentPage } from "./links.js";

/** The Mokly mark: two overlapping screens carrying two short rules. */
export function MoklyMark({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <rect
        x="3"
        y="3"
        width="20"
        height="21"
        rx="4"
        fill="currentColor"
        opacity="0.3"
      />
      <rect x="9" y="8" width="20" height="21" rx="4" fill="currentColor" />
      <path
        d="M14 15h10M14 20h7"
        stroke="var(--site-folio-surface)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The mark beside the serif wordmark, linking Home from every page. */
export function SiteBrand({ active }: { active: SiteScreen }) {
  return (
    <MockLink
      aria-current={currentPage(active, SITE_SCREENS.home)}
      aria-label="Mokly home"
      className="site-brand"
      to={SITE_SCREENS.home}
    >
      <MoklyMark />
      <span>
        mokly<span className="site-brand-dot">.</span>
      </span>
    </MockLink>
  );
}
