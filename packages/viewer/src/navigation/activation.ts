import type { LinkActivation } from "@mokly/frame/internal";

/** An ordinary primary activation that the shell may route in place. */
export function eligibleAnchor(
  event: LinkActivation & { readonly defaultPrevented: boolean },
  anchor: HTMLAnchorElement,
): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !anchor.hasAttribute("download") &&
    (!anchor.target || anchor.target === "_self")
  );
}
