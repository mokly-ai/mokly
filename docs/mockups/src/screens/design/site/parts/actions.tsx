import { MockLink } from "@mokly/mokly";

import { SiteIcon } from "./icons.js";
import { EXTERNAL_LINKS, GET_STARTED_SCREEN, SITE_SCREENS } from "./links.js";

/**
 * The home's action pair: a filled action and a secondary action. The
 * hero's Get started opens sign-up, and its secondary action is Download
 * for Mac, which opens the desktop releases. The open-foundation closing's
 * Docs opens the documentation, and its secondary action is View on GitHub.
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
        to={secondary === "download" ? GET_STARTED_SCREEN : SITE_SCREENS.docs}
      >
        {secondary === "download" ? "Get started" : "Docs"}{" "}
        <span aria-hidden="true" className="site-button-arrow">
          &#8594;
        </span>
      </MockLink>
      {secondary === "download" ? (
        <a
          className="site-button site-button--secondary"
          href={EXTERNAL_LINKS.desktopReleases}
        >
          <SiteIcon name="download" />
          Download for Mac
        </a>
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
