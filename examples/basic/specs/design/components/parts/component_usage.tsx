import { mockLink } from "@mokly/mokly";

import {
  UsageList,
  UsageStatus,
  type UsageRow,
} from "../../../../../../packages/ui/src/usage-list/usage-list.js";

import type { ComponentPageState } from "./component_details.js";
import type { ComponentDesignDestination } from "./destinations.js";
import { componentUses, usageViews } from "./fixtures.js";

/** The Usage tab while the entry's detail loads, or after its load failed. */
export function UsageDeliveryState({ state }: { state: "loading" | "failed" }) {
  return <UsageStatus status={state} />;
}

/** One consumer's row, which opens the artboard that shows the consumer. */
function usageRow(
  use: (typeof componentUses)[number],
  to: ComponentDesignDestination,
  instances: number,
): UsageRow {
  return {
    direct: true,
    href: mockLink(to),
    id: use.title,
    instances,
    key: use.title,
    removed: false,
    title: use.title,
    views: usageViews.length,
  };
}

/** The consumers of the shown component, as its Usage tab lists them. */
function usedByRows(state: ComponentPageState): UsageRow[] {
  if (state === "unused" || state === "added" || state === "overlay-tall")
    return [];
  if (state === "toolbar" || state === "hidden")
    return [
      usageRow(
        componentUses[0],
        state === "toolbar"
          ? "design/components/inspection/selection/inspection-toolbar"
          : "design/components/inspection/selection/inspection-help",
        1,
      ),
    ];
  return componentUses.map((use) => usageRow(use, use.to, use.count));
}

/**
 * The screens that a change of the shown component affects. A removed
 * variant keeps the screen that used it, which opens its Removed state.
 */
function affectedRows(
  removed: boolean,
  welcome: ComponentDesignDestination | undefined,
): UsageRow[] {
  const screens = componentUses
    .filter((use) => use.kind === "screen")
    .map((use) =>
      usageRow(
        use,
        use.title === "Welcome" ? (welcome ?? use.to) : use.to,
        use.count,
      ),
    );
  return removed
    ? [
        ...screens,
        {
          direct: true,
          href: mockLink("design/components/states/removed-consumer"),
          id: "Farewell",
          instances: 1,
          key: "Farewell",
          removed: true,
          title: "Farewell",
          views: 1,
        },
      ]
    : screens;
}

/**
 * The Usage tab: the consumers of the shown component and, when it changed,
 * the screens that its change affects.
 */
export function ComponentUsage({
  affected,
  removed = false,
  state,
  welcome,
}: {
  /** Whether the shown component changed, which lists the affected screens. */
  affected: boolean;
  removed?: boolean;
  state: ComponentPageState;
  /** Where Welcome's affected row opens when its story has an artboard for it. */
  welcome?: ComponentDesignDestination | undefined;
}) {
  return (
    <UsageList
      affected={affected ? affectedRows(removed, welcome) : []}
      usedBy={usedByRows(state)}
    />
  );
}
