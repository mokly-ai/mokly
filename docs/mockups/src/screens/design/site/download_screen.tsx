/**
 * The download page, one more file in the design tool. The heading stands
 * over the installers, with a redline that measures the space under it.
 * The installers are frames in two section boxes, Mac and Linux, each
 * labelled with the file that it downloads.
 */

import { SiteLayout } from "./parts/chrome.js";
import { DownloadInstallers } from "./parts/download-installers.js";
import { SiteKicker } from "./parts/labels.js";
import { SITE_SCREENS } from "./parts/links.js";
import { SiteRedline } from "./parts/selection.js";

type Viewport = "mobile" | "desktop";

/**
 * The space under the heading, down to the section boxes, which the
 * redline measures: 64px on desktop and 44px on mobile.
 */
const HEADING_SPACE: Readonly<Record<Viewport, string>> = {
  desktop: "64",
  mobile: "44",
};

/** The heading: the kicker and the title with its redline. */
function DownloadHeading({ viewport }: { viewport: Viewport }) {
  return (
    <div className="site-download-hero">
      <SiteKicker>Desktop app</SiteKicker>
      <div className="site-download-heading">
        <h1 className="site-download-title">Download Mokly</h1>
        <SiteRedline
          className="site-download-redline"
          value={HEADING_SPACE[viewport]}
        />
      </div>
    </div>
  );
}

/** The download screen, with its composition selected by the viewport. */
export function SiteDownloadScreen({ viewport }: { viewport: Viewport }) {
  return (
    <SiteLayout active={SITE_SCREENS.download} viewport={viewport}>
      <main className="site-download" id="main">
        <DownloadHeading viewport={viewport} />
        <DownloadInstallers />
      </main>
    </SiteLayout>
  );
}
