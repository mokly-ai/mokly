/**
 * Runs in Chromium: a pane opens one overlay at a time over its frame — its
 * row menu or one confirmation modal — and no overlay opens a layer of its own.
 * A row menu is a non-modal popover on desktop and a modal sheet on mobile.
 */
export function settingsDocumentViolations(): string[] {
  const problems: string[] = [];
  const dialogs = [...document.querySelectorAll('[role="dialog"]')];
  const frames = dialogs.filter((dialog) => dialog.matches(".fo-dialog"));
  const modals = dialogs.filter((dialog) =>
    dialog.closest(".fo-settings-modal-layer, .fo-menu-sheet-layer"),
  );
  const popovers = dialogs.filter(
    (dialog) =>
      dialog.closest(".fo-row-menu") && !dialog.closest(".fo-menu-sheet-layer"),
  );
  const overlays = [...modals, ...popovers];
  if (overlays.length > 1) problems.push("one overlay at a time");
  if (dialogs.length > frames.length + overlays.length)
    problems.push("unexpected overlay");
  for (const overlay of overlays)
    if (overlay.querySelector('[role="dialog"], [role="alertdialog"]'))
      problems.push("overlay opens no layer of its own");
  for (const dialog of [...frames, ...modals])
    if (dialog.getAttribute("aria-modal") !== "true")
      problems.push("dialog must be modal");
  for (const popover of popovers)
    if (popover.hasAttribute("aria-modal"))
      problems.push("row menu popover must stay non-modal");
  const surface = document.querySelector(
    "[data-mkc-screen^='product/settings/']",
  );
  if (!surface) return problems;
  if (!surface.querySelector(".fo-dialog, .fo-layer"))
    problems.push("settings frame required");
  const backdrop = surface.querySelector(".fo-settings-backdrop");
  if (backdrop) {
    if (backdrop.getAttribute("aria-hidden") !== "true")
      problems.push("page beneath must be inert");
    if (backdrop.querySelector("main, h1"))
      problems.push("page beneath keeps no landmark");
  }
  return problems;
}
