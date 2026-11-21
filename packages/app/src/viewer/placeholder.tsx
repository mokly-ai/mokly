import type { ReactNode } from "react";

import { SlotBar } from "./bar";
import type { ViewerHostProps, ViewerSelection, ViewerSlots } from "./host";
import { ViewerSlotSourceBoundary } from "./slot-source";

const slotOrder = ["lead", "middle", "trail"] as const;

/**
 * The cloud fallback before a ready catalogue can mount: its logical slot bar
 * above the one loading, empty or unavailable card the cloud owns. Ready
 * publications use the published package instead.
 */
export function ViewerStage({
  bar,
  selection,
  children,
}: {
  bar?: ReactNode;
  selection?: ViewerSelection;
  children?: ReactNode;
}) {
  return (
    <div className="fo-stage">
      {bar ?? (
        <div className="fo-stage-bar">
          {slotOrder.map((slot) => (
            <span
              className={"fo-stage-slot fo-stage-slot-" + slot}
              key={slot}
            />
          ))}
        </div>
      )}
      <div
        className="fo-stage-canvas"
        data-mkc-view={selection?.view}
        data-mkc-viewport={selection?.viewport}
        data-mkc-scheme={selection?.scheme}
        data-mkc-catalogue-screen={selection?.screen}
      >
        {children}
      </div>
    </div>
  );
}

function filled(slots: ViewerSlots | undefined): slots is ViewerSlots {
  if (!slots) return false;
  return Object.values(slots).some((slot) => slot !== undefined);
}

/**
 * The cloud-owned fallback for states that have no catalogue to mount. Ready
 * publications use the published package behind the same host contract.
 */
export function PlaceholderViewer({
  selection,
  status,
  stageMessage,
  slots,
}: ViewerHostProps) {
  return (
    <ViewerSlotSourceBoundary source="fallback">
      <ViewerStage
        bar={filled(slots) ? <SlotBar slots={slots} /> : undefined}
        selection={selection}
      >
        {status === "ready" ? undefined : stageMessage}
      </ViewerStage>
    </ViewerSlotSourceBoundary>
  );
}
