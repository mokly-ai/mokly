/**
 * Where activating a catalogue row from the Changes filter should land. A
 * parent screen that did not change itself only appears in Changes because
 * one of its variants did, so opening it opens that variant instead of a row
 * the filter would immediately contradict.
 */

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
  if (
    doc
      .querySelector('[data-filter="changed"]')
      ?.getAttribute("aria-pressed") !== "true"
  )
    return undefined;
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
