/**
 * The note filter: one floating bar with a native radio for all notes and
 * for each main note group, each with its count, then the status of what the
 * page shows. Native radios give the group its keyboard behaviour; the
 * site's script island applies the choice. The drawn state shows every note.
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

/** One option: a native radio, its icon, its name and its count. */
function FilterOption({
  checked,
  count,
  icon,
  label,
  value,
}: {
  checked: boolean;
  count: number;
  icon: SiteIconName | undefined;
  label: string;
  value: string;
}) {
  return (
    <label className="site-changelog-filter-option">
      <input
        className="site-changelog-filter-input site-visually-hidden"
        defaultChecked={checked}
        name="site-changelog-filter"
        type="radio"
        value={value}
      />
      {icon === undefined ? null : <SiteIcon name={icon} size={15} />}
      <span>{label}</span>{" "}
      <span className="site-changelog-filter-count">{count}</span>
    </label>
  );
}

/** The filter bar over the depicted releases, with All checked. */
export function ChangelogFilter({
  releases,
}: {
  releases: readonly Release[];
}) {
  return (
    <div className="site-changelog-filterbar">
      <fieldset aria-label="Show notes" className="site-changelog-filter">
        <FilterOption
          checked
          count={totalNotes(releases)}
          icon={undefined}
          label="All"
          value="all"
        />
        {FILTER_GROUPS.map((kind) => (
          <FilterOption
            checked={false}
            count={totalNotes(releases, kind)}
            icon={GROUP_ICONS[kind]}
            key={kind}
            label={GROUP_NAMES[kind].short}
            value={kind}
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
