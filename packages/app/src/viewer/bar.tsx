import type { ViewerSlots as PackageSlots } from "@mokly/viewer";

import { Brand } from "../components/brand";

import { useCompactBar } from "./bar-width";
import type { ViewerSlotName, ViewerSlots } from "./host";
import { ViewerSlotSourceBoundary } from "./slot-source";

/** One of the five cloud actions, whichever control carries it now. */
export type ViewerAction = Exclude<ViewerSlotName, "more">;

/** An action More can carry: every one but the publication, which stays. */
export type MoreAction = Exclude<ViewerAction, "switcher">;

/**
 * Where one composition of the bar puts the five cloud actions. More carries
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
    more: ["projects", "history", "share", "account"],
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
 * History, Share and the account where the placement gives each its own
 * trigger, then More when it carries any action.
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
      {own("account") && slots.account}
      {placement.more.length > 0 && slots.more !== true && slots.more && (
        <span className="fo-top-fixed">{slots.more}</span>
      )}
    </>
  );
}

/**
 * The start slot, after the package's mark: the project trigger on the full
 * bar. The compact bar carries the project in More, so it draws nothing here,
 * not even a wrapper, and the package's empty start slot gives the centre
 * column the bar's free room after the mark.
 */
function PackageSlotStart({ slots }: { slots: ViewerSlots }) {
  const placement = useBarPlacement();
  if (carriedByMore(placement, "projects")) return null;
  return (
    <ViewerSlotSourceBoundary source="package">
      <div className="fo-package-slot fo-package-slot-start">
        {slots.project}
      </div>
    </ViewerSlotSourceBoundary>
  );
}

/**
 * The centre slot: the publication, in the middle of the full bar and right
 * after the mark on the compact bar. Both compositions draw it in the same
 * place, so a change of composition keeps its trigger mounted, with any focus
 * it holds.
 */
function PackageSlotCenter({ slots }: { slots: ViewerSlots }) {
  const placement = useBarPlacement();
  return (
    <ViewerSlotSourceBoundary source="package">
      <div
        className={
          "fo-package-slot fo-package-slot-center" +
          (placement.compact ? " fo-package-slot-compact" : "")
        }
      >
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

/** Compose the cloud actions into the package's three documented top-bar slots. */
export function packageSlots(slots?: ViewerSlots): PackageSlots | undefined {
  if (!slots) return undefined;
  return {
    topBarStart: <PackageSlotStart slots={slots} />,
    topBarCenter: <PackageSlotCenter slots={slots} />,
    topBarEnd: <PackageSlotEnd slots={slots} />,
  };
}

/**
 * The application header, and the only navigation the product has: the five
 * slots the cloud fills, placed by the host. It takes the package bar's order
 * without a search, in three groups. A bar wide enough for all five holds the
 * mark and the project trigger, then the publication trigger with its state
 * in the middle of the bar, then History, Share and the account. A narrower
 * bar, as on every phone, holds the mark, the publication and More, which
 * carries the other actions.
 *
 * Both compositions draw the same three groups in the same order, so a change
 * of composition keeps the publication's trigger mounted, with any focus it
 * holds.
 */
export function SlotBar({ slots }: { slots: ViewerSlots }) {
  const placement = useBarPlacement();
  return (
    <div className="fo-top-bar">
      <span className="fo-top-slot">
        <Brand compact />
        {!carriedByMore(placement, "projects") && slots.project}
      </span>
      <span
        className={
          "fo-top-slot fo-top-grow" +
          (placement.compact ? " fo-compact-publication" : "")
        }
      >
        {slots.publication}
      </span>
      <span className="fo-top-slot fo-top-trail">
        <EndTriggers slots={slots} placement={placement} />
      </span>
    </div>
  );
}
