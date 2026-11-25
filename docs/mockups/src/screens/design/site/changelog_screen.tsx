/**
 * The changelog, read as the design file's version history: Version history
 * beside the release frames, the page title as a selected text layer, the
 * release timeline, the note filter, then a full frame for each of the six
 * newest releases and the Earlier releases section of compact frames for the
 * older ones. The newest release is the one in view: its frame is selected,
 * its row is current and the playhead stands on it. The mobile composition
 * has no panel.
 */

import "./styles/shared.js";
import "./styles/changelog.js";

import { ChangelogEarlier } from "./parts/changelog-earlier.js";
import { FULL_FRAMES } from "./parts/changelog-facts.js";
import { ChangelogFilter } from "./parts/changelog-filter.js";
import { ChangelogHistory } from "./parts/changelog-history.js";
import { ChangelogRelease } from "./parts/changelog-release.js";
import { ChangelogTimeline } from "./parts/changelog-timeline.js";
import { SiteLayout } from "./parts/chrome.js";
import { SITE_SCREENS } from "./parts/links.js";
import { RELEASES } from "./parts/releases.js";
import { SiteSelection } from "./parts/selection.js";

/**
 * The page title as a selected text layer, with its name tag, its type
 * badge on desktop and its size, then the lead.
 */
function ChangelogIntro({ viewport }: { viewport: "mobile" | "desktop" }) {
  const desktop = viewport === "desktop";
  return (
    <div className="site-changelog-intro">
      <div className="site-changelog-heading">
        <h1>What&#8217;s new in Mokly</h1>
        <SiteSelection
          badge={
            desktop ? (
              <>
                Geist Semibold <b>96</b>
              </>
            ) : undefined
          }
          handles="all"
          name="Heading"
          size={desktop ? "849 × 94" : "350 × 96"}
        />
      </div>
      <p className="site-lead">Every release of the Mokly CLI, newest first.</p>
    </div>
  );
}

function SiteChangelog({ viewport }: { viewport: "mobile" | "desktop" }) {
  const current = RELEASES[0]?.version;
  return (
    <SiteLayout active={SITE_SCREENS.changelog} viewport={viewport}>
      <main className="site-changelog" id="main">
        <div className="site-changelog-body">
          {viewport === "desktop" ? (
            <ChangelogHistory current={current} releases={RELEASES} />
          ) : null}
          <div className="site-changelog-frames">
            <ChangelogIntro viewport={viewport} />
            <ChangelogTimeline
              current={current}
              releases={RELEASES}
              viewport={viewport}
            />
            <ChangelogFilter releases={RELEASES} />
            <div className="site-releases">
              {RELEASES.slice(0, FULL_FRAMES).map((release) => (
                <ChangelogRelease
                  key={release.version}
                  latest={release.version === current}
                  release={release}
                  selected={release.version === current}
                />
              ))}
            </div>
            <ChangelogEarlier releases={RELEASES.slice(FULL_FRAMES)} />
          </div>
        </div>
      </main>
    </SiteLayout>
  );
}

/** The changelog screen, with its composition selected by the viewport. */
export function SiteChangelogScreen({
  viewport,
}: {
  viewport: "mobile" | "desktop";
}) {
  return <SiteChangelog viewport={viewport} />;
}
