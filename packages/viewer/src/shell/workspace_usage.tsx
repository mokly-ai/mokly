/** Recorded component consumers rendered as stable grouped usage links. */

import type { UsageLink, WorkspaceData } from "./workspace_data.js";

/** Build the routed consumer URL that selects its recorded instance. */
export function usageHref(link: UsageLink): string {
  const query = new URLSearchParams({
    viewport: link.viewport,
    scheme: link.colorScheme,
    instance: link.instanceKey,
  });
  if (link.variantId) query.set("variant", link.variantId);
  if (link.removed && link.comparisonEligible) query.set("comparison", "side");
  const route = link.route.split("/").map(encodeURIComponent).join("/");
  return `/view/${route}?${query}`;
}

/** Usage and affected-consumer sections for the inspector. */
export function WorkspaceUsage({ data }: { data: WorkspaceData }) {
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
  section: string;
  title: string;
}) {
  const groups = groupedUsage(links);
  return (
    <section data-usage-section={section}>
      <h3>{title}</h3>
      {!groups.length ? (
        <p>No recorded consumers.</p>
      ) : (
        <ul className="mbk-usage-list">
          {groups.map((values) => {
            const first = values[0]!;
            const instances = new Set(values.map((value) => value.instanceKey))
              .size;
            const views = new Set(
              values.map((value) => `${value.viewport}/${value.colorScheme}`),
            ).size;
            return (
              <li
                data-usage-link={JSON.stringify([
                  first.route,
                  first.variantId ?? "",
                  first.removed,
                ])}
                key={usageGroupKey(first)}
              >
                <a href={usageHref(first)}>
                  {first.title}
                  {first.variantId ? ` · ${first.variantId}` : ""}
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

function groupedUsage(links: readonly UsageLink[]): UsageLink[][] {
  const groups = new Map<string, UsageLink[]>();
  for (const link of links) {
    const key = usageGroupKey(link);
    groups.set(key, [...(groups.get(key) ?? []), link]);
  }
  return [...groups.values()];
}

function usageGroupKey(link: UsageLink): string {
  return `${link.route}|${link.variantId ?? ""}|${link.removed}|${link.comparisonEligible}`;
}
