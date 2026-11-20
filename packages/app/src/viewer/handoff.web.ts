import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  HTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

import type { ViewerSlotSource } from "./slot-source";

type ViewerHandoffRootProps = Pick<
  HTMLAttributes<HTMLDivElement>,
  "onClick" | "onKeyDownCapture" | "onPointerDownCapture"
>;

type PendingActivation =
  | { kind: "pointer"; pointerId: number; slot: string }
  | { key: "enter" | "space"; kind: "keyboard"; slot: string };

interface ActiveSlot {
  name: string;
  source: ViewerSlotSource;
}

function activationKey(key: string): "enter" | "space" | undefined {
  if (key === "Enter") return "enter";
  if (key === " " || key === "Spacebar") return "space";
  return undefined;
}

function activeSlot(target: EventTarget | null): ActiveSlot | undefined {
  if (!(target instanceof Element)) return undefined;
  const slot = target.closest<HTMLElement>("[data-mkc-viewer-slot]");
  const control = target.closest<HTMLElement>("button, [role='button']");
  if (!slot || !control || !slot.contains(control)) return undefined;
  if (
    control.getAttribute("aria-disabled") === "true" ||
    (control instanceof HTMLButtonElement && control.disabled)
  ) {
    return undefined;
  }
  const name = slot.dataset.mkcViewerSlot;
  const source = slot.dataset.mkcViewerSource;
  if (!name || (source !== "fallback" && source !== "package")) {
    return undefined;
  }
  return { name, source };
}

/**
 * Keep the fallback slot alive only until its native activation concludes.
 *
 * A primary pointer press or a Space/Enter press that begins on a fallback
 * control holds the ready mount. The hold is released one frame after the
 * matching pointer-up or key-up, so the ensuing click still runs on the
 * control it began on. Releasing off that slot, pointer cancellation, window
 * blur or another interaction cancels the hold and releases the package
 * without opening anything. Only an activation that began in the fallback
 * generation can hold the transition; a package control is never held.
 */
export function useViewerSlotHandoff(): {
  holdReady: boolean;
  rootProps: ViewerHandoffRootProps;
} {
  const [pending, setPendingState] = useState<PendingActivation>();
  const pendingRef = useRef<PendingActivation | undefined>(undefined);
  const releaseFrame = useRef(0);

  const cancelFrame = useCallback(() => {
    cancelAnimationFrame(releaseFrame.current);
    releaseFrame.current = 0;
  }, []);
  const setPending = useCallback(
    (next: PendingActivation | undefined) => {
      cancelFrame();
      pendingRef.current = next;
      setPendingState(next);
    },
    [cancelFrame],
  );
  const releaseAfterActivation = useCallback(
    (held: PendingActivation) => {
      cancelFrame();
      releaseFrame.current = requestAnimationFrame(() => {
        if (pendingRef.current === held) setPending(undefined);
      });
    },
    [cancelFrame, setPending],
  );

  useEffect(() => {
    const pointerUp = (event: PointerEvent) => {
      const held = pendingRef.current;
      if (held?.kind !== "pointer" || held.pointerId !== event.pointerId)
        return;
      if (activeSlot(event.target)?.name === held.slot) {
        releaseAfterActivation(held);
      } else {
        setPending(undefined);
      }
    };
    const pointerCancel = (event: PointerEvent) => {
      const held = pendingRef.current;
      if (held?.kind === "pointer" && held.pointerId === event.pointerId) {
        setPending(undefined);
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      const held = pendingRef.current;
      if (held?.kind !== "keyboard" || activationKey(event.key) !== held.key) {
        return;
      }
      if (activeSlot(event.target)?.name === held.slot) {
        releaseAfterActivation(held);
      } else {
        setPending(undefined);
      }
    };
    const pointerDown = (event: PointerEvent) => {
      const held = pendingRef.current;
      if (
        held?.kind === "keyboard" &&
        activeSlot(event.target)?.name !== held.slot
      ) {
        setPending(undefined);
      }
    };
    const blur = () => setPending(undefined);
    document.addEventListener("pointerdown", pointerDown, true);
    document.addEventListener("pointerup", pointerUp);
    document.addEventListener("pointercancel", pointerCancel);
    document.addEventListener("keyup", keyUp);
    window.addEventListener("blur", blur);
    return () => {
      document.removeEventListener("pointerdown", pointerDown, true);
      document.removeEventListener("pointerup", pointerUp);
      document.removeEventListener("pointercancel", pointerCancel);
      document.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", blur);
    };
  }, [releaseAfterActivation, setPending]);

  useEffect(() => cancelFrame, [cancelFrame]);

  const pointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const slot = activeSlot(event.target);
      if (
        !event.isPrimary ||
        event.button !== 0 ||
        slot?.source !== "fallback"
      ) {
        setPending(undefined);
        return;
      }
      setPending({
        kind: "pointer",
        pointerId: event.pointerId,
        slot: slot.name,
      });
    },
    [setPending],
  );
  const keyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const key = activationKey(event.key);
      const slot = activeSlot(event.target);
      if (key && slot?.source === "fallback") {
        if (!event.repeat) {
          setPending({ key, kind: "keyboard", slot: slot.name });
        }
        return;
      }
      if (pendingRef.current?.kind === "keyboard") setPending(undefined);
    },
    [setPending],
  );
  const click = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const held = pendingRef.current;
      if (held && activeSlot(event.target)?.name === held.slot) {
        setPending(undefined);
      }
    },
    [setPending],
  );
  const rootProps = useMemo<ViewerHandoffRootProps>(
    () => ({
      onClick: click,
      onKeyDownCapture: keyDown,
      onPointerDownCapture: pointerDown,
    }),
    [click, keyDown, pointerDown],
  );
  return { holdReady: pending !== undefined, rootProps };
}
