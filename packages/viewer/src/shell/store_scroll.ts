/** Browser history persistence for shell-owned scroll regions. */

/** Read every named stage or inspector scroll position. */
export function captureScrolls(doc: Document): Record<string, number> {
  return Object.fromEntries(
    [...doc.querySelectorAll<HTMLElement>("[data-mokly-scroll]")].flatMap(
      (region) => {
        const key = region.dataset["moklyScroll"];
        return key ? [[key, region.scrollTop]] : [];
      },
    ),
  );
}

/** Restore every named position that exists in the next route tree. */
export function restoreScrolls(
  doc: Document,
  scrolls: Readonly<Record<string, number>>,
): void {
  for (const region of doc.querySelectorAll<HTMLElement>(
    "[data-mokly-scroll]",
  )) {
    const key = region.dataset["moklyScroll"];
    if (key && scrolls[key] !== undefined) region.scrollTop = scrolls[key];
  }
}

/** Replace only the scroll payload of the current history entry. */
export function persistScroll(
  win: Window & typeof globalThis,
  scrolls: Readonly<Record<string, number>>,
): void {
  const existing =
    win.history.state && typeof win.history.state === "object"
      ? win.history.state
      : {};
  win.history.replaceState({ ...existing, scrolls }, "", win.location.href);
}

/** Validate the scroll payload read from untrusted browser history state. */
export function historyScrolls(
  value: unknown,
): Readonly<Record<string, number>> {
  if (!value || typeof value !== "object" || !("scrolls" in value)) return {};
  const scrolls = value.scrolls;
  if (!scrolls || typeof scrolls !== "object" || Array.isArray(scrolls))
    return {};
  return Object.fromEntries(
    Object.entries(scrolls).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === "number" && Number.isFinite(entry[1]),
    ),
  );
}
