/**
 * The tree scroll memory of the Layers panel, which shows from 1024px. The
 * panel's tree keeps its scroll offset across docs pages in the same tab,
 * through refresh and history, and reveals the current page when it opens
 * outside the visible tree. When tab storage is unavailable the links still
 * work and the current page is still revealed. The tree sheet below 1024px
 * keeps no position.
 */

import { revealCurrent } from "./tree-reveal.js";

const STORAGE_KEY = "mokly.docs.tree.scrollTop";
const PANEL = window.matchMedia("(min-width: 1024px)");

function savedScrollTop(): number | null {
  try {
    const value = window.sessionStorage.getItem(STORAGE_KEY);
    if (value === null) return null;
    const offset = Number(value);
    return Number.isFinite(offset) && offset >= 0 ? offset : null;
  } catch {
    return null;
  }
}

function saveScrollTop(offset: number): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, String(offset));
  } catch {
    return;
  }
}

const tree = document.querySelector<HTMLElement>(
  ".site-docs-side .site-doc-tree-scroll",
);

if (tree) {
  const restore = () => {
    if (!PANEL.matches) return;
    const saved = savedScrollTop();
    if (saved !== null) tree.scrollTop = saved;
    revealCurrent(tree);
    saveScrollTop(tree.scrollTop);
  };

  tree.addEventListener(
    "scroll",
    () => {
      if (PANEL.matches) saveScrollTop(tree.scrollTop);
    },
    { passive: true },
  );
  tree.addEventListener("click", () => {
    if (PANEL.matches) saveScrollTop(tree.scrollTop);
  });
  PANEL.addEventListener("change", restore);
  restore();
}
