/**
 * Opens and closes the tree sheet below 1024px. The sub-bar's Layers control
 * opens the sheet as a modal dialog that drops in under the sub-bar, and
 * reveals the current page's row with the smallest scroll. Escape, a press
 * on the dimmed page and a tree link close it, and the control's
 * `aria-expanded` follows. While the sheet is open the page behind it is
 * inert, so a press on the control's place lands on the dimmed page and
 * closes the sheet too. The sheet also closes when the Layers panel takes
 * over at 1024px, and when the reader leaves the page, so a page restored
 * from the back and forward cache shows it closed.
 */

import { revealCurrent } from "./tree-reveal.js";

const PANEL = window.matchMedia("(min-width: 1024px)");

const sheet = document.querySelector<HTMLDialogElement>("dialog#docs-layers");
const opener = document.querySelector<HTMLButtonElement>(
  'button[aria-controls="docs-layers"]',
);

if (sheet && opener) {
  const close = () => {
    if (sheet.open) sheet.close();
  };

  opener.addEventListener("click", () => {
    sheet.showModal();
    opener.setAttribute("aria-expanded", "true");
    const tree = sheet.querySelector<HTMLElement>(".site-doc-tree-scroll");
    if (tree) revealCurrent(tree);
  });
  sheet.addEventListener("close", () => {
    opener.setAttribute("aria-expanded", "false");
  });
  sheet.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a")) close();
  });

  // `closedby="any"` closes the sheet on a press outside it. Where the
  // browser does not implement it, a press on the backdrop targets the
  // dialog itself, while a press on the sheet, which its tree fills, targets
  // one of its children.
  if (!("closedBy" in HTMLDialogElement.prototype)) {
    sheet.addEventListener("click", (event) => {
      if (event.target === sheet) close();
    });
  }

  PANEL.addEventListener("change", (event) => {
    if (event.matches) close();
  });
  window.addEventListener("pagehide", close);
}
