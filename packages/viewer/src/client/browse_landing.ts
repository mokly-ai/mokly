/**
 * Where activating a catalogue row from the Changes filter should land. A
 * parent screen that did not change itself only appears in Changes because
 * one of its variants did, so opening it opens that variant instead of a row
 * the filter would immediately contradict.
 *
 * Arriving from Changes is also recorded, because the destination cannot tell
 * a filtered activation from a pasted URL, a Back step, or a reload. The
 * activation writes one short-lived intent naming the destination; the
 * workspace reads and clears it on install, and lands on the first changed
 * view only when the intent names the page it is installing into. Every other
 * arrival keeps the sticky viewport and scheme.
 */

/** Session-scoped key holding the destination a Changes activation opened. */
const CHANGES_LANDING_KEY = "mokly:changes-landing";

/** Whether the catalogue column is currently filtered to changed entries. */
export function changesFilterSelected(doc: Document): boolean {
  return (
    doc
      .querySelector('[data-filter="changed"]')
      ?.getAttribute("aria-pressed") === "true"
  );
}

/**
 * The first changed variant an activated parent row should open, or
 * `undefined` when the row is its own destination: All is selected, the row
 * itself changed, the row carries no aggregate mark, or nothing in its list
 * survives the current constraints.
 */
export function changesLandingHref(row: Element): string | undefined {
  const doc = row.ownerDocument;
  if (!doc || !row.hasAttribute("data-nav-row")) return undefined;
  if (row.getAttribute("data-changed") === "true") return undefined;
  if (row.getAttribute("data-changed-variants") !== "true") return undefined;
  if (!changesFilterSelected(doc)) return undefined;
  const listId = row.parentElement
    ?.querySelector("[data-nav-variants-toggle]")
    ?.getAttribute("aria-controls");
  const list =
    listId === null || listId === undefined ? null : doc.getElementById(listId);
  if (!list) return undefined;
  for (const variant of list.querySelectorAll<HTMLElement>("[data-nav-row]")) {
    if (variant.hidden || variant.getAttribute("data-changed") !== "true")
      continue;
    return variant.getAttribute("href") ?? undefined;
  }
  return undefined;
}

/**
 * Record that `href` was opened from a changed row while Changes was selected,
 * either because the row itself changed or because it redirects to a changed
 * variant. Storage that rejects the write leaves the destination on its sticky
 * selection, which is the same behaviour as any other arrival.
 */
export function rememberChangesLanding(
  win: Window & typeof globalThis,
  row: Element,
  href: string,
): void {
  const doc = row.ownerDocument;
  if (!doc || !row.hasAttribute("data-nav-row")) return;
  if (!changesFilterSelected(doc)) return;
  if (
    row.getAttribute("data-changed") !== "true" &&
    changesLandingHref(row) === undefined
  )
    return;
  try {
    win.sessionStorage.setItem(
      CHANGES_LANDING_KEY,
      new URL(href, win.location.href).href,
    );
  } catch {
    return;
  }
}

/**
 * Read the intent once and clear it, reporting whether it named the page now
 * being installed. Clearing on every install keeps the landing to the one
 * arrival it was recorded for, so Back, Forward, and reload stay sticky.
 */
export function consumeChangesLanding(
  win: Window & typeof globalThis,
): boolean {
  let stored: string | null;
  try {
    stored = win.sessionStorage.getItem(CHANGES_LANDING_KEY);
    if (stored !== null) win.sessionStorage.removeItem(CHANGES_LANDING_KEY);
  } catch {
    return false;
  }
  if (stored === null) return false;
  try {
    return (
      new URL(stored, win.location.href).pathname === win.location.pathname
    );
  } catch {
    return false;
  }
}
