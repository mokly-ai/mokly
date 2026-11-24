/**
 * Version history: the floating panel beside the release frames. It lists
 * the depicted releases by month on one rail, each row a link to its frame
 * with its date and a mark for breaking changes, and marks the release in
 * view. Its foot names the Atom feed as plain text, because no mockup owns
 * the feed.
 */

import { Fragment } from "react";

import {
  isBreaking,
  isPatch,
  releaseId,
  releaseMonths,
  shortDate,
} from "./changelog-facts.js";
import { classNames } from "./class-names.js";
import { SiteIcon } from "./icons.js";
import { SitePanel, SitePanelRow } from "./panel.js";
import type { Release } from "./release.js";

/**
 * One row, a link to its release's frame: the version, the breaking mark and
 * the date. A patch release draws a smaller dot on the rail.
 */
function HistoryRow({
  current,
  release,
}: {
  current: boolean;
  release: Release;
}) {
  return (
    <SitePanelRow
      className={classNames(
        "site-release-index-link",
        current && "site-release-index-link--current",
        isPatch(release) && "site-release-index-link--patch",
      )}
      current={current ? "true" : undefined}
      href={`#${releaseId(release)}`}
      trailing={
        <time className="site-release-index-date" dateTime={release.date}>
          {shortDate(release.date)}
        </time>
      }
    >
      <span className="site-release-index-version">v{release.version}</span>
      {isBreaking(release) ? (
        <span className="site-release-index-mark" title="Breaking changes">
          <SiteIcon name="alert" size={13} />
          <span className="site-visually-hidden">, breaking changes</span>
        </span>
      ) : null}
    </SitePanelRow>
  );
}

/**
 * The Version history panel, with the release count in its head. `current`
 * names the version of the release in view.
 */
export function ChangelogHistory({
  current,
  releases,
}: {
  current: string | undefined;
  releases: readonly Release[];
}) {
  return (
    <SitePanel
      as="nav"
      className="site-release-index"
      foot={<SitePanelRow icon="feed">Atom feed</SitePanelRow>}
      meta={String(releases.length)}
      metaMono
      title="Version history"
    >
      {releaseMonths(releases).map((month) => (
        <Fragment key={month.month}>
          <p className="site-release-index-month">{month.month}</p>
          {month.releases.map((release) => (
            <HistoryRow
              current={release.version === current}
              key={release.version}
              release={release}
            />
          ))}
        </Fragment>
      ))}
    </SitePanel>
  );
}
