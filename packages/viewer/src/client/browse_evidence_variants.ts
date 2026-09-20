/**
 * Reconcile the removed variants a surviving parent's list holds. A deleted
 * variant keeps its Removed row inside the parent it belonged to, so a
 * background baseline can give a parent its first list, take the last one
 * away again, or leave a retained row exactly where the reader left it.
 */

/** Align every parent's variant list with the incoming generation. */
export function reconcileRemovedVariants(
  doc: Document,
  next: Document,
  removed: ReadonlyMap<string | null, HTMLAnchorElement>,
): void {
  const incoming = new Set<string>();
  for (const nextList of next.querySelectorAll<HTMLElement>(
    "[data-nav-variants]",
  )) {
    const id = nextList.getAttribute("id");
    if (id === null) continue;
    incoming.add(id);
    const list = doc.getElementById(id) ?? adoptVariantList(doc, nextList);
    if (list) placeRemovedRows(doc, nextList, list, removed);
  }
  for (const list of doc.querySelectorAll<HTMLElement>("[data-nav-variants]")) {
    const id = list.getAttribute("id");
    if (id !== null && !incoming.has(id)) releaseVariantList(list);
  }
}

/**
 * Give a parent row that had no variants the incoming leaf container and its
 * list. The live row moves into the adopted container so its selection,
 * focus and evidence attributes survive; the removed rows are placed
 * afterwards, by the caller, from the rows the reader already had.
 */
function adoptVariantList(
  doc: Document,
  nextList: HTMLElement,
): HTMLElement | null {
  const nextLeaf = nextList.previousElementSibling;
  const nextRow = nextLeaf?.querySelector("a[data-nav-row]");
  const href = nextRow?.getAttribute("href") ?? null;
  if (!nextLeaf?.querySelector("[data-nav-variants-toggle]") || href === null)
    return null;
  const current = [
    ...doc.querySelectorAll<HTMLAnchorElement>("a[data-nav-row]"),
  ].find((row) => row.getAttribute("href") === href);
  if (!current) return null;
  const leaf = doc.importNode(nextLeaf, true);
  const placeholder = leaf.querySelector("a[data-nav-row]");
  current.replaceWith(leaf);
  placeholder?.replaceWith(current);
  const list = doc.importNode(nextList, true);
  for (const row of list.querySelectorAll("a[data-nav-removed]")) row.remove();
  leaf.after(list);
  return list;
}

/**
 * Return a parent whose last removed variant came back to a plain row. The
 * aggregate mark goes with the list: nothing else would clear it once the
 * disclosure that earned it is gone.
 */
function releaseVariantList(list: HTMLElement): void {
  if (list.querySelector("[data-nav-row]")) return;
  const leaf = list.previousElementSibling;
  const row = leaf?.querySelector("[data-nav-variants-toggle]")
    ? leaf.querySelector("a[data-nav-row]")
    : null;
  list.remove();
  if (!leaf || !row) return;
  row.removeAttribute("data-changed-variants");
  leaf.replaceWith(row);
}

/** Order the incoming removed rows after the list's current variants. */
function placeRemovedRows(
  doc: Document,
  nextList: HTMLElement,
  list: HTMLElement,
  removed: ReadonlyMap<string | null, HTMLAnchorElement>,
): void {
  let following: ChildNode | null = null;
  for (const row of [
    ...nextList.querySelectorAll<HTMLAnchorElement>("a[data-nav-removed]"),
  ].reverse()) {
    const href = row.getAttribute("href");
    const retained = removed.get(href) ?? doc.importNode(row, true);
    for (const duplicate of list.querySelectorAll<HTMLAnchorElement>(
      "a[data-nav-removed]",
    ))
      if (duplicate !== retained && duplicate.getAttribute("href") === href)
        duplicate.remove();
    if (retained.parentElement !== list || retained.nextSibling !== following)
      list.insertBefore(retained, following);
    following = retained;
  }
}
