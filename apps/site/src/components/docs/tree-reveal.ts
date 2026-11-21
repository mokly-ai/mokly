/**
 * Reveals the current page's row inside a scrolling section tree with the
 * smallest scroll that brings the whole row into view. A row that is already
 * in view keeps its place. Only the tree scrolls, never the document.
 */
export function revealCurrent(tree: HTMLElement): void {
  const current = tree.querySelector<HTMLElement>('[aria-current="page"]');
  if (!current) return;
  const viewport = tree.getBoundingClientRect();
  const row = current.getBoundingClientRect();
  if (row.top < viewport.top) {
    tree.scrollTop += row.top - viewport.top;
  } else if (row.bottom > viewport.bottom) {
    tree.scrollTop += row.bottom - viewport.bottom;
  }
}
