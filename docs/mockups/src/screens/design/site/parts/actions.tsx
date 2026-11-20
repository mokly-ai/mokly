import { MockLink } from "@mokly/mokly";

import { EXTERNAL_LINKS, GET_STARTED_SCREEN } from "./links.js";

/** The hero and closing action pair, repeated on the home screen. */
export function SiteActions() {
  return (
    <div className="site-actions">
      <MockLink
        className="site-button site-button--primary"
        to={GET_STARTED_SCREEN}
      >
        Get started <span aria-hidden="true">&#8594;</span>
      </MockLink>
      <a
        className="site-button site-button--quiet"
        href={EXTERNAL_LINKS.github}
      >
        View on GitHub
      </a>
    </div>
  );
}
