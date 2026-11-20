import { useEffect } from "react";

import { markCoveredAreas, scrollMeetsArea, unmarkAreas } from "./drag-covers";

/** The widths of the window buttons that the shared stylesheet resolves. */
const insets = ["--fo-window-inset", "--fo-window-inset-end"] as const;

/** The changes of the page that can show, move or hide a cover. */
const pageChanges: MutationObserverInit = {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ["class", "style", "hidden", "open"],
};

/** The focus changes, which show and hide a skip link and open surfaces. */
const focusEvents = ["focusin", "focusout"] as const;

const listening = { capture: true, passive: true } as const;

/** Whether the window reports its buttons: an inset resolves above zero. */
function reportsButtons(view: Window): boolean {
  const style = view.getComputedStyle(view.document.documentElement);
  return insets.some(
    (inset) => Number.parseFloat(style.getPropertyValue(inset)) > 0,
  );
}

/** A running check: ask for one more, or stop and unmark every area. */
interface Checks {
  request: () => void;
  stop: () => void;
}

/**
 * Check after each change of the page, scroll that can move a cover and focus
 * change, at most once in each animation frame. A failed read leaves the
 * areas as they are.
 */
function startChecks(view: Window): Checks {
  const { document } = view;
  let frame: number | undefined;
  const run = () => {
    frame = undefined;
    try {
      markCoveredAreas(document);
    } catch {
      // The areas keep their marks, and the page keeps working.
    }
  };
  const request = () => {
    frame ??= view.requestAnimationFrame(run);
  };
  const scrolled = (event: Event) => {
    if (frame === undefined && scrollMeetsArea(event.target, document)) {
      request();
    }
  };
  const observer = new MutationObserver(request);
  observer.observe(document.body, pageChanges);
  document.addEventListener("scroll", scrolled, listening);
  for (const type of focusEvents) {
    document.addEventListener(type, request, listening);
  }
  request();
  return {
    request,
    stop: () => {
      observer.disconnect();
      document.removeEventListener("scroll", scrolled, listening);
      for (const type of focusEvents) {
        document.removeEventListener(type, request, listening);
      }
      if (frame !== undefined) view.cancelAnimationFrame(frame);
      frame = undefined;
      unmarkAreas(document);
    },
  };
}

/**
 * The window controls overlay, which reports a change of the buttons'
 * geometry, for example in full screen. An engine without it has none.
 */
function controlsOverlay(navigator: Navigator): EventTarget | undefined {
  if (!("windowControlsOverlay" in navigator)) return undefined;
  const overlay = navigator.windowControlsOverlay;
  return overlay instanceof EventTarget ? overlay : undefined;
}

/**
 * Turn off the drag of each area that something covers, while the window
 * reports its buttons. Chromium collects drag regions in document order and
 * ignores what paints on top, so a cover of an area takes presses only while
 * the area does not move the window. A browser, a phone and the Linux app
 * report no buttons, so only the resize and overlay listeners stay attached,
 * and they read the two insets again. Returns the function that ends the
 * watch.
 */
function watchCoveredDragAreas(view: Window): () => void {
  const overlay = controlsOverlay(view.navigator);
  let checks: Checks | undefined;
  const evaluate = () => {
    try {
      if (!reportsButtons(view)) {
        checks?.stop();
        checks = undefined;
      } else if (checks === undefined) {
        checks = startChecks(view);
      } else {
        checks.request();
      }
    } catch {
      // The areas and the watch stay as they are.
    }
  };
  view.addEventListener("resize", evaluate);
  overlay?.addEventListener("geometrychange", evaluate);
  evaluate();
  return () => {
    view.removeEventListener("resize", evaluate);
    overlay?.removeEventListener("geometrychange", evaluate);
    checks?.stop();
    checks = undefined;
  };
}

/**
 * The drag check of the Mac window, once for the whole app. A native tree has
 * no page, so it watches nothing.
 */
export function useCoveredDragAreas(): void {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    return watchCoveredDragAreas(window);
  }, []);
}
