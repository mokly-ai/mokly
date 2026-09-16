/** Snapshot revisions and navigation admission shared by live and progressive updates. */

export interface BrowsePageStamp {
  content: number;
  version: number;
}

export function readPageStamp(doc: Document): BrowsePageStamp | undefined {
  const content = pageVersion(doc, "content");
  const version = pageVersion(doc, "update");
  return content !== undefined && version !== undefined && content <= version
    ? { content, version }
    : undefined;
}

export function pageVersion(
  doc: Document,
  kind: "content" | "update",
): number | undefined {
  const raw = doc.documentElement.getAttribute(`data-mokly-${kind}-version`);
  if (!raw || !/^[1-9]\d*$/.test(raw)) return;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : undefined;
}

export function navigationPending(doc: Document): boolean {
  return doc.documentElement.hasAttribute("data-mokly-navigating");
}

export function beginNavigation(doc: Document): void {
  doc.documentElement.setAttribute("data-mokly-navigating", "");
}

export function finishNavigation(doc: Document): void {
  doc.documentElement.removeAttribute("data-mokly-navigating");
  const Event = doc.defaultView?.Event;
  if (Event) doc.dispatchEvent(new Event("mokly:navigation-settled"));
}

export async function waitForNavigation(
  doc: Document,
  signal: AbortSignal,
): Promise<void> {
  while (navigationPending(doc) && !signal.aborted) {
    await new Promise<void>((resolve) => {
      const settled = () => {
        doc.removeEventListener("mokly:navigation-settled", settled);
        signal.removeEventListener("abort", settled);
        resolve();
      };
      doc.addEventListener("mokly:navigation-settled", settled, {
        once: true,
      });
      signal.addEventListener("abort", settled, { once: true });
    });
  }
  signal.throwIfAborted();
}
