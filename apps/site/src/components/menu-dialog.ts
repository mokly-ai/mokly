/**
 * Opens and closes the mobile header's menu. The menu control opens the
 * sheet as a modal dialog. The close control, Escape and a press on the
 * dimmed page below the sheet close it, and focus returns to the menu
 * control. The sheet also closes when the desktop composition replaces the
 * mobile one, and when the reader leaves the page, so a page restored from
 * the back and forward cache shows it closed.
 */

const DESKTOP = window.matchMedia("(min-width: 768px)");

const menu = document.querySelector<HTMLDialogElement>("dialog#site-menu");
const opener = document.querySelector<HTMLButtonElement>(
  'button[aria-controls="site-menu"]',
);

if (menu && opener) {
  const close = () => {
    if (menu.open) menu.close();
  };

  opener.addEventListener("click", () => {
    menu.showModal();
    opener.setAttribute("aria-expanded", "true");
  });
  menu.addEventListener("close", () => {
    opener.setAttribute("aria-expanded", "false");
  });
  menu.querySelector(".site-menu-close")?.addEventListener("click", close);

  // `closedby="any"` closes the menu on a press outside the sheet. Where the
  // browser does not implement it, a press on the backdrop targets the dialog
  // itself, while a press anywhere on the sheet, which its panel fills, or on
  // the close control targets one of its children.
  if (!("closedBy" in HTMLDialogElement.prototype)) {
    menu.addEventListener("click", (event) => {
      if (event.target === menu) close();
    });
  }

  DESKTOP.addEventListener("change", (event) => {
    if (event.matches) close();
  });
  window.addEventListener("pagehide", close);
}

// A module, so its names stay out of the scope the page's other scripts share.
export {};
