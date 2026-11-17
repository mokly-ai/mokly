import { useEffect } from "react";
import type { RefObject } from "react";

/** What Tab may land on inside an overlay, mirroring the package's own trap. */
const focusable = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** The overlay's own controls a reader can reach, in document order. */
function reachable(surface: HTMLElement): HTMLElement[] {
  return Array.from(surface.querySelectorAll<HTMLElement>(focusable)).filter(
    (element) => {
      if (element.getAttribute("aria-disabled") === "true") return false;
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    },
  );
}

/**
 * Keep Tab inside the top-most overlay.
 *
 * The package's modal frame traps Tab with a document-level listener for every
 * frame that is open, so a question opened over the settings dialog has two
 * traps listening. The dialog's runs first, finds focus outside its own
 * surface, cancels the key and tries to pull focus back into a surface the
 * question has made inert — so Tab moves nowhere. While the question is open,
 * its own surface takes Tab at the window, before either trap, and moves focus
 * between its controls itself. Remove this once the package traps only its
 * top-most frame.
 */
export function useTopmostTab(surface: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const node = surface.current;
      if (!node) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const controls = reachable(node);
      if (controls.length === 0) return;
      const at = controls.indexOf(document.activeElement as HTMLElement);
      const step = event.shiftKey ? -1 : 1;
      const next =
        at < 0
          ? event.shiftKey
            ? controls.length - 1
            : 0
          : (at + step + controls.length) % controls.length;
      controls[next]?.focus();
    };
    window.addEventListener("keydown", handle, true);
    return () => window.removeEventListener("keydown", handle, true);
  }, [surface]);
}
