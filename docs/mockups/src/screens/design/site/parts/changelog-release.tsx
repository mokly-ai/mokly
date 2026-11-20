/**
 * One release as a frame on the canvas: its anchor label above it, the head
 * with the version, the date, the release link and the compare range, the
 * count chips that jump to each group, and the groups on a rail. Breaking
 * changes are a callout pinned to the frame like a comment, because they
 * need action, and the upgrade notes close the groups. The selected frame
 * draws the selection and its size tag. The compact frames of the earlier
 * releases reuse the title, the date, the link, the chips and the notes.
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
import { ReleaseUpgrade } from "./changelog-upgrade.js";
import { classNames } from "./class-names.js";
import { SiteFrameLabel } from "./frame-label.js";
import { SiteIcon } from "./icons.js";
import { SiteChip } from "./labels.js";
import type { Release, ReleaseGroup } from "./release.js";
import { SiteSelection } from "./selection.js";

/** The anchor label above a frame, such as `# v0.19.0 · 12 November 2026`. */
export function ReleaseLabel({
  release,
  selected,
}: {
  release: Release;
  selected: boolean;
}) {
  return (
    <SiteFrameLabel
      icon="hash"
      name={`v${release.version} · ${readableDate(release.date)}`}
      selected={selected}
    />
  );
}

/** The title, Mokly CLI and the version; a compact frame hides the product. */
export function ReleaseTitle({
  compact,
  release,
}: {
  compact: boolean;
  release: Release;
}) {
  return (
    <h2 id={`${releaseId(release)}-title`}>
      <span
        className={classNames(
          "site-release-product",
          compact && "site-visually-hidden",
        )}
      >
        Mokly CLI
      </span>{" "}
      <span className="site-release-version">{release.version}</span>
    </h2>
  );
}

/** The release date from the heading, with Latest on the newest release. */
export function ReleaseDate({
  latest,
  release,
}: {
  latest: boolean;
  release: Release;
}) {
  return (
    <p className="site-release-date">
      <time dateTime={release.date}>{readableDate(release.date)}</time>
      {latest ? (
        <SiteChip dot tone="signal">
          Latest
        </SiteChip>
      ) : null}
    </p>
  );
}

/** Read release details: the compare view that the heading links. */
export function ReleaseLink({ release }: { release: Release }) {
  return (
    <a
      className="site-button site-button--secondary site-release-link"
      href={release.compare}
    >
      Read release details <span aria-hidden="true">&#8599;</span>
    </a>
  );
}

/**
 * The count chips: one per group, each a link to that group, and one for the
 * upgrade notes. A compact frame keeps each chip's icon and count in sight
 * and gives its name to the reader and the tooltip.
 */
export function ReleaseCounts({
  compact,
  release,
}: {
  compact: boolean;
  release: Release;
}) {
  const chips = release.groups.map((group) => ({
    count: group.notes.length,
    kind: group.kind,
    name: GROUP_NAMES[group.kind].short,
    title: `${GROUP_NAMES[group.kind].title}: ${group.notes.length}`,
  }));
  return (
    <ul
      aria-label={`Notes in ${release.version}`}
      className="site-release-counts"
    >
      {chips.map((chip) => (
        <li key={chip.kind}>
          <a
            className="site-release-count"
            href={`#${groupId(release, chip.kind)}`}
            title={compact ? chip.title : undefined}
          >
            <SiteChip
              icon={GROUP_ICONS[chip.kind]}
              tone={chip.kind === "breaking" ? "changed" : "neutral"}
            >
              <span className={compact ? "site-visually-hidden" : undefined}>
                {chip.name}
              </span>{" "}
              <b>{chip.count}</b>
            </SiteChip>
          </a>
        </li>
      ))}
      {release.upgrade === undefined ? null : (
        <li>
          <a
            className="site-release-count"
            href={`#${groupId(release, "upgrade")}`}
            title={compact ? "Upgrade notes" : undefined}
          >
            <SiteChip icon="doc">
              <span className={compact ? "site-visually-hidden" : undefined}>
                Upgrade notes
              </span>
            </SiteChip>
          </a>
        </li>
      )}
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
  const breaking = group.kind === "breaking";
  return (
    <section
      className={classNames(
        "site-release-group",
        breaking && "site-release-group--breaking",
      )}
      id={groupId(release, group.kind)}
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

/** The note groups on their rail, then the upgrade notes when published. */
export function ReleaseNotes({ release }: { release: Release }) {
  return (
    <div className="site-release-notes">
      {release.groups.map((group) => (
        <ReleaseGroupNotes group={group} key={group.kind} release={release} />
      ))}
      <ReleaseUpgrade release={release} />
    </div>
  );
}

/**
 * A full release frame. `latest` adds the Latest chip to the newest release,
 * and `selected` draws the selection with the release's note count as its
 * size tag and turns the frame label green.
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
      <ReleaseLabel release={release} selected={selected} />
      <div className="site-release-meta">
        <ReleaseTitle compact={false} release={release} />
        <ReleaseDate latest={latest} release={release} />
        <p className="site-release-links">
          <ReleaseLink release={release} />
          <span className="site-release-compare">{compareRange(release)}</span>
        </p>
      </div>
      <ReleaseCounts compact={false} release={release} />
      <ReleaseNotes release={release} />
      {selected ? (
        <SiteSelection size={counted(noteCount(release), "note")} />
      ) : null}
    </article>
  );
}
