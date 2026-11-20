/**
 * The note filter: one floating bar with a segment for all notes and for each
 * main note group, each with its count, then the status of what the page
 * shows. The segments are native buttons, and the chosen one carries
 * `aria-current`, as a segmented control marks its selected segment; the
 * site's script island applies the choice and moves the mark. The drawn
 * state shows every note, with All chosen.
 */

import {
  FILTER_GROUPS,
  GROUP_ICONS,
  GROUP_NAMES,
  counted,
  totalNotes,
} from "./changelog-facts.js";
import { SiteIcon, type SiteIconName } from "./icons.js";
import type { Release } from "./release.js";

/** One segment: its icon, its name and its count. */
function FilterOption({
  count,
  current,
  icon,
  label,
}: {
  count: number;
  current: boolean;
  icon: SiteIconName | undefined;
  label: string;
}) {
  return (
    <button
      aria-current={current ? "true" : undefined}
      className="site-changelog-filter-option"
      type="button"
    >
      {icon === undefined ? null : <SiteIcon name={icon} size={15} />}
      <span>{label}</span>{" "}
      <span className="site-changelog-filter-count">{count}</span>
    </button>
  );
}

/** The filter bar over the depicted releases, with All chosen. */
export function ChangelogFilter({
  releases,
}: {
  releases: readonly Release[];
}) {
  return (
    <div className="site-changelog-filterbar">
      <fieldset aria-label="Show notes" className="site-changelog-filter">
        <FilterOption
          count={totalNotes(releases)}
          current
          icon={undefined}
          label="All"
        />
        {FILTER_GROUPS.map((kind) => (
          <FilterOption
            count={totalNotes(releases, kind)}
            current={false}
            icon={GROUP_ICONS[kind]}
            key={kind}
            label={GROUP_NAMES[kind].short}
          />
        ))}
      </fieldset>
      <p aria-live="polite" className="site-changelog-filter-status">
        {counted(totalNotes(releases), "note")} in{" "}
        {counted(releases.length, "release")}
      </p>
    </div>
  );
}
