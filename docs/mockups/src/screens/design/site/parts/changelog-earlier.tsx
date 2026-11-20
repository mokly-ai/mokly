/**
 * Earlier releases: the section of the canvas below the full frames, as the
 * home's Specs section groups its frames. Each older release is a compact
 * frame: its anchor label, the version, the date, the count chips and Read
 * release details in one row, and its notes in a closed native disclosure
 * whose summary counts them. The notes stay in the document, so a count chip
 * or a search reaches them.
 */

import { counted, dateRange, noteCount, releaseId } from "./changelog-facts.js";
import {
  ReleaseCounts,
  ReleaseDate,
  ReleaseLabel,
  ReleaseLink,
  ReleaseNotes,
  ReleaseTitle,
} from "./changelog-release.js";
import { SiteIcon } from "./icons.js";
import { SiteSectionBox } from "./labels.js";
import type { Release } from "./release.js";

/** One compact frame, with its notes in a closed disclosure. */
function CompactRelease({ release }: { release: Release }) {
  return (
    <article
      aria-labelledby={`${releaseId(release)}-title`}
      className="site-release site-release--compact"
      id={releaseId(release)}
    >
      <ReleaseLabel release={release} selected={false} />
      <div className="site-release-meta">
        <ReleaseTitle compact release={release} />
        <ReleaseDate latest={false} release={release} />
        <ReleaseCounts compact release={release} />
        <p className="site-release-links">
          <ReleaseLink release={release} />
        </p>
      </div>
      <details className="site-release-details site-release-more">
        <summary className="site-button site-button--secondary site-release-summary site-release-toggle">
          <span className="site-release-when-closed">
            Show {counted(noteCount(release), "note")}
          </span>
          <span className="site-release-when-open">Hide notes</span>
          <SiteIcon
            className="site-release-chevron"
            name="chevronDown"
            size={15}
          />
        </summary>
        <ReleaseNotes release={release} />
      </details>
    </article>
  );
}

/**
 * The earlier releases section, headed by its tag and a mono line with the
 * number of releases and their dates. `releases` are newest first.
 */
export function ChangelogEarlier({
  releases,
}: {
  releases: readonly Release[];
}) {
  const newest = releases[0];
  const oldest = releases.at(-1);
  if (newest === undefined || oldest === undefined) return null;
  return (
    <SiteSectionBox
      className="site-changelog-earlier"
      meta={`${counted(releases.length, "release")} · ${dateRange(oldest.date, newest.date)}`}
      tag="Earlier releases"
      tagId="earlier-releases"
    >
      {releases.map((release) => (
        <CompactRelease key={release.version} release={release} />
      ))}
    </SiteSectionBox>
  );
}
