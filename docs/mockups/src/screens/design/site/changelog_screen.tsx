/**
 * The changelog, read as the catalogue's Changes list: an index of
 * the published releases beside rows that pair a version badge and date with
 * the grouped notes of that release.
 */

import { SiteLayout, SiteTrail } from "./parts/chrome.js";
import { SITE_SCREENS } from "./parts/links.js";
import { RELEASES } from "./parts/releases.js";

function ReleaseIndex() {
  return (
    <nav aria-label="Releases" className="site-release-index">
      <p className="site-tree-head">Releases</p>
      {RELEASES.map((release, index) => (
        <a
          className={
            index === 0
              ? "site-release-index-link site-release-index-link--current"
              : "site-release-index-link"
          }
          href={`#${release.id}`}
          key={release.id}
        >
          <span className="site-release-index-version">{release.version}</span>
          <span className="site-release-index-date">
            {release.readableDate}
          </span>
        </a>
      ))}
    </nav>
  );
}

function SiteChangelog({ viewport }: { viewport: "mobile" | "desktop" }) {
  return (
    <SiteLayout active={SITE_SCREENS.changelog} viewport={viewport}>
      <main className="site-document site-changelog" id="main">
        <div className="site-document-intro">
          <SiteTrail trail={["Changelog"]} />
          <h1>
            What&#8217;s new in <span className="site-accent">Mokly</span>
          </h1>
          <p className="site-lead">
            Every release of the Mokly CLI, newest first.
          </p>
        </div>
        <div className="site-changelog-body">
          <ReleaseIndex />
          <div className="site-releases">
            {RELEASES.map((release) => (
              <article
                className="site-release"
                id={release.id}
                key={release.id}
              >
                <div className="site-release-meta">
                  <h2>
                    <span className="site-badge site-badge--neutral">
                      Mokly CLI {release.version}
                    </span>
                  </h2>
                  <time dateTime={release.date}>{release.readableDate}</time>
                  <a className="site-release-link" href={release.compare}>
                    Read release details <span aria-hidden="true">&#8599;</span>
                  </a>
                </div>
                <div className="site-release-notes">
                  {release.groups.map((group) => (
                    <div className="site-release-group" key={group.title}>
                      <p className="site-release-group-head">{group.title}</p>
                      <ul>
                        {group.notes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </article>
            ))}
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
