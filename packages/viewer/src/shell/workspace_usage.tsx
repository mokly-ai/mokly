/** Recorded component consumers rendered as stable grouped usage links. */

import { viewHref } from "../navigation/routes.js";

import type { DetailDelivery } from "./data_requests.js";
import type { UsageLink, WorkspaceData } from "./workspace_data.js";

/** The Usage sections: current uses, and the consumers a change affects. */
export type UsageSectionName = "affected" | "used-by";

/**
 * Build the routed consumer URL that selects its recorded instance. An
 * affected consumer, and a removed one, open its side-by-side comparison
 * when the consumer can be compared, even when it has no Changes row.
 */
export function usageHref(
  link: UsageLink,
  section: UsageSectionName = "used-by",
): string {
  const query = new URLSearchParams({
    viewport: link.viewport,
    scheme: link.colorScheme,
    instance: link.instanceKey,
  });
  if (link.comparisonEligible && (section === "affected" || link.removed))
    query.set("comparison", "side");
  return `${viewHref(link.entryId)}?${query}`;
}

/** Usage and affected-consumer sections for the inspector. */
export function WorkspaceUsage({
  data,
  delivery,
}: {
  data: WorkspaceData;
  delivery: DetailDelivery;
}) {
  if (delivery.status !== "ready")
    return (
      <section aria-label="Usage status" data-usage-section="status">
        {delivery.status === "failed" ? (
          <>
            <p role="alert">Usage couldn’t be loaded.</p>
            <button
              className="mbk-text-button"
              onClick={delivery.retry}
              type="button"
            >
              Try again
            </button>
          </>
        ) : (
          <p role="status">Loading usage…</p>
        )}
      </section>
    );
  if (data.usageComplete === false)
    return (
      <p data-usage-section="status">
        Usage is unavailable until the catalogue has been checked.
      </p>
    );
  return (
    <>
      <UsageSection title="Used by" section="used-by" links={data.usedBy} />
      {data.affected.length ? (
        <UsageSection
          title="Affected screens and components"
          section="affected"
          links={data.affected}
        />
      ) : null}
    </>
  );
}

function UsageSection({
  links,
  section,
  title,
}: {
  links: readonly UsageLink[];
  section: UsageSectionName;
  title: string;
}) {
  const rows = usageRows(links);
  return (
    <section data-usage-section={section}>
      <h3>{title}</h3>
      {!rows.length ? (
        <p>No recorded consumers.</p>
      ) : (
        <ul className="mbk-usage-list">
          {rows.map(({ key, links: values }) => {
            const first = values[0]!;
            const instances = new Set(values.map((value) => value.instanceKey))
              .size;
            const views = new Set(
              values.map((value) => `${value.viewport}/${value.colorScheme}`),
            ).size;
            return (
              <li
                data-usage-link={JSON.stringify([first.entryId, first.removed])}
                key={key}
              >
                <a href={usageHref(first, section)}>
                  {first.title}
                  {first.removed ? " · Removed" : ""}
                </a>
                <small>
                  {values.some((value) => value.direct)
                    ? "Direct use"
                    : "Nested use"}
                  {` · ${instances} instances · ${views} views`}
                </small>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Group links into rows, each with its React key. A row's key names only what
 * the row shows, its entry and whether that entry is removed, so an update
 * that changes only the comparison eligibility keeps the row's link element
 * and the focus on it. Rows that share this identity keep their order and
 * take a numbered key.
 */
export function usageRows(
  links: readonly UsageLink[],
): { key: string; links: readonly UsageLink[] }[] {
  const groups = new Map<string, UsageLink[]>();
  for (const link of links) {
    const key = usageGroupKey(link);
    groups.set(key, [...(groups.get(key) ?? []), link]);
  }
  const seen = new Map<string, number>();
  return [...groups.values()].map((values) => {
    const first = values[0]!;
    const identity = JSON.stringify([
      first.entryKind,
      first.entryId,
      first.removed,
    ]);
    const repeat = seen.get(identity) ?? 0;
    seen.set(identity, repeat + 1);
    return { key: repeat ? `${identity}#${repeat}` : identity, links: values };
  });
}

function usageGroupKey(link: UsageLink): string {
  return `${link.entryKind}|${link.entryId}|${link.removed}|${link.comparisonEligible}`;
}
