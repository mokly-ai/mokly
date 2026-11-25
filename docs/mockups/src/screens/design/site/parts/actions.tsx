import { MockLink } from "@mokly/mokly";

import { SiteIcon } from "./icons.js";
import { EXTERNAL_LINKS, GET_STARTED_SCREEN, SITE_SCREENS } from "./links.js";

/**
 * The home's action pair: the filled Get started, which opens the
 * documentation, and a secondary action. The hero's secondary action is
 * Download for Mac, which opens the download page; the open-foundation
 * closing's is View on GitHub.
 */
export function SiteActions({
  secondary,
}: {
  secondary: "download" | "github";
}) {
  return (
    <div className="site-actions">
      <MockLink
        className="site-button site-button--primary"
        to={GET_STARTED_SCREEN}
      >
        Get started{" "}
        <span aria-hidden="true" className="site-button-arrow">
          &#8594;
        </span>
      </MockLink>
      {secondary === "download" ? (
        <MockLink
          className="site-button site-button--secondary"
          to={SITE_SCREENS.download}
        >
          <SiteIcon name="download" />
          Download for Mac
        </MockLink>
      ) : (
        <a
          className="site-button site-button--secondary"
          href={EXTERNAL_LINKS.github}
        >
          <SiteIcon name="github" size={18} />
          View on GitHub
        </a>
      )}
    </div>
  );
}
