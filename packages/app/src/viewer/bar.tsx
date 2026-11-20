import type { ViewerSlots as PackageSlots } from "@mokly/viewer";

import { Brand } from "../components/brand";

import { useCompactBar } from "./bar-width";
import type { ViewerSlotName, ViewerSlots } from "./host";
import { ViewerSlotSourceBoundary } from "./slot-source";

/** One of the six cloud actions, whichever control carries it now. */
export type ViewerAction = Exclude<ViewerSlotName, "more">;

/** An action More can carry: every one but the publication, which stays. */
export type MoreAction = Exclude<ViewerAction, "switcher">;

/**
 * Where one composition of the bar puts the six cloud actions. More carries
 * the actions it lists, in its order, and every other action keeps its own
 * trigger. The bar draws its triggers from this, More draws its rows from it,
 * and a dismissed overlay returns focus through it, so the three cannot
 * disagree about where an action is.
 */
export interface BarPlacement {
  /** Whether the bar draws its compact composition. */
  compact: boolean;
  more: readonly MoreAction[];
}

const placements = {
  full: { compact: false, more: [] },
  compact: {
    compact: true,
    more: ["projects", "history", "share", "settings", "account"],
  },
} as const satisfies Record<"full" | "compact", BarPlacement>;

/** The placement of the composition that the bar's measured width chose. */
export function barPlacement(compact: boolean): BarPlacement {
  return compact ? placements.compact : placements.full;
}

/** Whether More carries the action, rather than its own trigger. */
function carriedByMore(placement: BarPlacement, action: ViewerAction): boolean {
  return placement.more.some((carried) => carried === action);
}

/** The slot of the control that carries the action now: its own, or More. */
export function carrierSlot(
  placement: BarPlacement,
  action: ViewerAction,
): ViewerSlotName {
  return carriedByMore(placement, action) ? "more" : action;
}

function useBarPlacement(): BarPlacement {
  return barPlacement(useCompactBar());
}

/**
 * History, Share, Settings and the account where the placement gives each its
 * own trigger, then More when it carries any action.
 *
 * More sits in a cloud-owned wrapper that the row centres, whichever menu
 * fills the slot: a menu can align its own trigger to the top of a row that is
 * taller than the trigger. The wrapper sets no size. An absent More slot draws
 * nothing, so it gets no wrapper either.
 */
function EndTriggers({
  slots,
  placement,
}: {
  slots: ViewerSlots;
  placement: BarPlacement;
}) {
  const own = (action: MoreAction) => !carriedByMore(placement, action);
  return (
    <>
      {own("history") && slots.history}
      {own("share") && slots.share}
      {own("settings") && slots.settings}
      {own("account") && slots.account}
      {placement.more.length > 0 && slots.more !== true && slots.more && (
        <span className="fo-top-fixed">{slots.more}</span>
      )}
    </>
  );
}

function PackageSlotStart({ slots }: { slots: ViewerSlots }) {
  const placement = useBarPlacement();
  return (
    <ViewerSlotSourceBoundary source="package">
      <div
        className={
          "fo-package-slot fo-package-slot-start" +
          (placement.compact ? " fo-package-slot-compact" : "")
        }
      >
        {!carriedByMore(placement, "projects") && slots.project}
        <span className="fo-package-publication">{slots.publication}</span>
      </div>
    </ViewerSlotSourceBoundary>
  );
}

function PackageSlotEnd({ slots }: { slots: ViewerSlots }) {
  const placement = useBarPlacement();
  return (
    <ViewerSlotSourceBoundary source="package">
      <div
        className={
          "fo-package-slot fo-package-slot-end" +
          (placement.compact ? " fo-package-slot-compact" : "")
        }
      >
        <EndTriggers slots={slots} placement={placement} />
      </div>
    </ViewerSlotSourceBoundary>
  );
}

/** Compose the cloud actions into the package's two documented top-bar slots. */
export function packageSlots(slots?: ViewerSlots): PackageSlots | undefined {
  if (!slots) return undefined;
  return {
    topBarStart: <PackageSlotStart slots={slots} />,
    topBarEnd: <PackageSlotEnd slots={slots} />,
  };
}

/**
 * The application header, and the only navigation the product has: the six
 * slots the cloud fills, placed by the host. A bar wide enough for all six
 * fills one row — the mark and the project trigger, then the publication
 * trigger with its state, then History, Share, Settings and the account. A
 * narrower bar, as on every phone, keeps the publication visible and carries
 * the other actions in More.
 *
 * Both compositions give the publication's slot the same key, so a change of
 * composition keeps its trigger mounted, with any focus it holds, although
 * the slot's position among the bar's children differs between them.
 */
export function SlotBar({ slots }: { slots: ViewerSlots }) {
  const placement = useBarPlacement();
  const project = !carriedByMore(placement, "projects") && slots.project;
  if (placement.compact) {
    return (
      <div className="fo-top-bar">
        <Brand compact />
        {project}
        <span
          key="publication"
          className="fo-top-slot fo-top-grow fo-compact-publication"
        >
          {slots.publication}
        </span>
        <EndTriggers slots={slots} placement={placement} />
      </div>
    );
  }
  return (
    <div className="fo-top-bar">
      <span className="fo-top-slot fo-top-leading">
        <Brand compact />
        {project}
      </span>
      <span key="publication" className="fo-top-slot fo-top-grow">
        {slots.publication}
      </span>
      <span className="fo-top-slot fo-top-trail">
        <EndTriggers slots={slots} placement={placement} />
      </span>
    </div>
  );
}
