/** Browser-frame enhancements: the expand-to-overlay toggle and the
 * address-pill copy affordance. Both are delegated so they survive
 * progressive route swaps. */

/** The currently expanded browser frame, if any. */
export function expandedFrame(doc: Document): HTMLElement | undefined {
  return (
    doc.querySelector<HTMLElement>(".browser-frame.is-expanded") ?? undefined
  );
}

/** Collapse one expanded frame and restore its toggle state. */
export function collapseFrame(doc: Document, frame?: HTMLElement): void {
  doc.body.classList.remove("frame-expanded");
  if (!frame) return;
  frame.classList.remove("is-expanded");
  const button = frame.querySelector<HTMLElement>(".browser-expand");
  if (!button) return;
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", "Expand to a wider viewport");
  button.setAttribute("title", "Expand to a wider viewport");
}

function expandFrame(doc: Document, frame: HTMLElement): void {
  frame.classList.add("is-expanded");
  doc.body.classList.add("frame-expanded");
  const button = frame.querySelector<HTMLElement>(".browser-expand");
  if (!button) return;
  button.setAttribute("aria-expanded", "true");
  button.setAttribute("aria-label", "Collapse viewport");
  button.setAttribute("title", "Collapse viewport");
}

/**
 * Handle one document click for frame expansion. Returns true when the click
 * belonged to the expand toggle and navigation handling should stop.
 */
export function handleFrameClick(doc: Document, target: Element): boolean {
  const button = target.closest<HTMLElement>(".browser-expand");
  if (button) {
    const frame = button.closest<HTMLElement>(".browser-frame");
    if (!frame) return true;
    const current = expandedFrame(doc);
    if (current && current !== frame) collapseFrame(doc, current);
    if (frame.classList.contains("is-expanded")) collapseFrame(doc, frame);
    else expandFrame(doc, frame);
    return true;
  }
  const current = expandedFrame(doc);
  if (current && !target.closest(".browser-frame.is-expanded")) {
    collapseFrame(doc, current);
  }
  return false;
}

/**
 * Handle one document click for the address copy affordance. Returns true
 * when the click copied an address and should not navigate.
 */
export function handleAddressClick(
  doc: Document,
  target: Element,
  copy: (text: string) => Promise<void> | void,
): boolean {
  const address = target.closest<HTMLElement>(".browser-bar .address");
  if (!address) return false;
  const url = address.querySelector<HTMLElement>(".address-url") ?? address;
  const text = url.textContent?.trim() ?? "";
  if (text !== "") void copy(text);
  const bar = address.parentElement;
  if (!bar) return true;
  bar.querySelector(".address-copied")?.remove();
  const hint = doc.createElement("span");
  hint.className = "address-copied";
  hint.textContent = "URL copied";
  bar.appendChild(hint);
  setTimeout(() => hint.remove(), 1400);
  return true;
}
