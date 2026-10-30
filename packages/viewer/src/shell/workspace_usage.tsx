/**
 * Recorded component consumers rendered as stable grouped usage links. This
 * container groups the links into rows, keys them, and builds each consumer's
 * address. `@mokly/ui/usage-list` renders the sections and their states.
 */

import { UsageList, UsageStatus, type UsageRow } from "@mokly/ui/usage-list";

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
      <UsageStatus
        onRetry={delivery.status === "failed" ? delivery.retry : undefined}
        status={delivery.status === "failed" ? "failed" : "loading"}
      />
    );
  if (data.usageComplete === false) return <UsageStatus status="unchecked" />;
  return (
    <UsageList
      affected={sectionRows(data.affected, "affected")}
      usedBy={sectionRows(data.usedBy, "used-by")}
    />
  );
}

/** The rows of one section: each consumer once, with its counts and address. */
function sectionRows(
  links: readonly UsageLink[],
  section: UsageSectionName,
): UsageRow[] {
  return usageRows(links).map(({ key, links: values }) => {
    const first = values[0]!;
    return {
      direct: values.some((value) => value.direct),
      href: usageHref(first, section),
      id: JSON.stringify([first.entryId, first.removed]),
      instances: new Set(values.map((value) => value.instanceKey)).size,
      key,
      removed: first.removed,
      title: first.title,
      views: new Set(
        values.map((value) => `${value.viewport}/${value.colorScheme}`),
      ).size,
    };
  });
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
