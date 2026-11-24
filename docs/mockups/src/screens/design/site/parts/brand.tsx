import { MockLink } from "@mokly/mokly";

import { SITE_SCREENS, type SiteScreen, currentPage } from "./links.js";

/**
 * The Mokly mark: an ink outline frame behind a green front layer that
 * carries two short rules, the selected layer of a design file. The
 * stylesheet colours its three parts from the site's roles.
 */
export function MoklyMark({ size = 30 }: { size?: number | undefined }) {
  return (
    <svg
      aria-hidden="true"
      className="site-mark"
      focusable="false"
      height={size}
      viewBox="0 0 32 32"
      width={size}
    >
      <rect
        className="site-mark-back"
        height="19.8"
        rx="4.6"
        width="18.8"
        x="3.6"
        y="3.6"
      />
      <rect
        className="site-mark-front"
        height="21"
        rx="4.8"
        width="20"
        x="9"
        y="8"
      />
      <path className="site-mark-rules" d="M14 15h10M14 20h7" />
    </svg>
  );
}

/** The mark beside the Geist wordmark, linking Home from every page. */
export function SiteBrand({ active }: { active: SiteScreen }) {
  return (
    <MockLink
      aria-current={currentPage(active, SITE_SCREENS.home)}
      aria-label="Mokly home"
      className="site-brand"
      to={SITE_SCREENS.home}
    >
      <MoklyMark />
      <span className="site-brand-word">
        mokly<span className="site-brand-dot">.</span>
      </span>
    </MockLink>
  );
}
