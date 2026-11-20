import { useRef } from "react";
import type { RefObject } from "react";

import type { BarPlacement } from "../../viewer/bar";
import { carrierSlot } from "../../viewer/bar";
import type { CarrierLookup } from "../../viewer/focus";
import type { ViewerSlotName } from "../../viewer/host";

/** The controls that can carry a cloud action: each trigger, and More. */
export type SlotRefs = Record<
  ViewerSlotName,
  RefObject<HTMLSpanElement | null>
>;

/**
 * The controls a dismissed overlay can return focus to. One ref per slot that
 * can carry a cloud action, created in a fixed order so the set is the same on
 * every render. The bar's placement says which of them carries an action now.
 */
export function useSlotRefs(): SlotRefs {
  const projects = useRef<HTMLSpanElement | null>(null);
  const switcher = useRef<HTMLSpanElement | null>(null);
  const history = useRef<HTMLSpanElement | null>(null);
  const share = useRef<HTMLSpanElement | null>(null);
  const settings = useRef<HTMLSpanElement | null>(null);
  const account = useRef<HTMLSpanElement | null>(null);
  const more = useRef<HTMLSpanElement | null>(null);
  const refs = useRef<SlotRefs>({
    projects,
    switcher,
    history,
    share,
    settings,
    account,
    more,
  });
  return refs.current;
}

/**
 * The control that carries an overlay's opener in the placement the bar draws
 * now: the action's own trigger, or More while More carries the action. The
 * stage's Open billing control is not one of the bar's actions, so the
 * settings dialog's own focus return answers for it.
 */
export function carrierLookup(
  refs: SlotRefs,
  placement: BarPlacement,
): CarrierLookup {
  return (opener) =>
    opener === "stage-open-billing"
      ? null
      : refs[carrierSlot(placement, opener)].current;
}
