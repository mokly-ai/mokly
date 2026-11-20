/**
 * One release as a frame on the canvas: its anchor label above it, the head
 * with the version, the date, the release link and the compare range, the
 * count chips that jump to each group, and the groups on a rail. Breaking
 * changes are a callout pinned to the frame like a comment, because they
 * need action. The selected frame draws the selection and its size tag.
 */

import {
  GROUP_ICONS,
  GROUP_NAMES,
  compareRange,
  counted,
  groupId,
  noteCount,
  readableDate,
  releaseId,
} from "./changelog-facts.js";
import { ReleaseNote } from "./changelog-note.js";
import { SiteFrameLabel } from "./frame-label.js";
import { SiteIcon } from "./icons.js";
import { SiteChip } from "./labels.js";
import type { Release, ReleaseGroup } from "./release.js";
import { SiteSelection } from "./selection.js";

/** The head: Mokly CLI and the version, the date, and the release links. */
function ReleaseHead({
  latest,
  release,
}: {
  latest: boolean;
  release: Release;
}) {
  return (
    <div className="site-release-meta">
      <h2 id={`${releaseId(release)}-title`}>
        <span className="site-release-product">Mokly CLI</span>{" "}
        <span className="site-release-version">{release.version}</span>
      </h2>
      <p className="site-release-date">
        <time dateTime={release.date}>{readableDate(release.date)}</time>
        {latest ? (
          <SiteChip dot tone="signal">
            Latest
          </SiteChip>
        ) : null}
      </p>
      <p className="site-release-links">
        <a
          className="site-button site-button--secondary site-release-link"
          href={release.compare}
        >
          Read release details <span aria-hidden="true">&#8599;</span>
        </a>
        <span className="site-release-compare">{compareRange(release)}</span>
      </p>
    </div>
  );
}

/** The count chips: one per group, each a link to that group. */
function ReleaseCounts({ release }: { release: Release }) {
  return (
    <ul
      aria-label={`Notes in ${release.version}`}
      className="site-release-counts"
    >
      {release.groups.map((group) => (
        <li key={group.kind}>
          <a
            className="site-release-count"
            href={`#${groupId(release, group.kind)}`}
          >
            <SiteChip
              icon={GROUP_ICONS[group.kind]}
              tone={group.kind === "breaking" ? "changed" : "neutral"}
            >
              {GROUP_NAMES[group.kind].short} <b>{group.notes.length}</b>
            </SiteChip>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** One group of notes; breaking changes become the pinned callout. */
function ReleaseGroupNotes({
  group,
  release,
}: {
  group: ReleaseGroup;
  release: Release;
}) {
  const id = groupId(release, group.kind);
  const breaking = group.kind === "breaking";
  return (
    <section
      className={
        breaking
          ? "site-release-group site-release-group--breaking"
          : "site-release-group"
      }
      id={id}
    >
      {breaking ? (
        <span aria-hidden="true" className="site-release-pin">
          !
        </span>
      ) : null}
      <div className="site-release-group-head">
        <h3 className="site-release-group-title">
          <SiteIcon name={GROUP_ICONS[group.kind]} />
          <span>
            {GROUP_NAMES[group.kind].title}{" "}
            <span className="site-release-group-count">
              {group.notes.length}
            </span>
          </span>
        </h3>
        {breaking ? (
          <p className="site-release-group-hint">Read before you upgrade.</p>
        ) : null}
      </div>
      <ul>
        {group.notes.map((note) => (
          <ReleaseNote key={note} markdown={note} />
        ))}
      </ul>
    </section>
  );
}

/**
 * A release frame. `latest` adds the Latest chip to the newest release, and
 * `selected` draws the selection with the release's note count as its size
 * tag and turns the frame label green.
 */
export function ChangelogRelease({
  latest,
  release,
  selected,
}: {
  latest: boolean;
  release: Release;
  selected: boolean;
}) {
  return (
    <article
      aria-labelledby={`${releaseId(release)}-title`}
      className="site-release"
      id={releaseId(release)}
    >
      <SiteFrameLabel
        icon="hash"
        name={`v${release.version} · ${readableDate(release.date)}`}
        selected={selected}
      />
      <ReleaseHead latest={latest} release={release} />
      <ReleaseCounts release={release} />
      <div className="site-release-notes">
        {release.groups.map((group) => (
          <ReleaseGroupNotes group={group} key={group.kind} release={release} />
        ))}
      </div>
      {selected ? (
        <SiteSelection size={counted(noteCount(release), "note")} />
      ) : null}
    </article>
  );
}
