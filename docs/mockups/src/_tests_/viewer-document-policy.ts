/** Runs in Chromium: the viewer keeps one panel over an inert stage. */
export function viewerDocumentViolations(): string[] {
  const problems: string[] = [];
  const screen = document.querySelector("[data-mkc-screen^='product/viewer/']");
  if (!screen) return ["viewer screen required"];
  const dialogs = document.querySelectorAll('[role="dialog"]');
  if (dialogs.length > 1) problems.push("nested panel");
  for (const dialog of dialogs) {
    if (dialog.querySelector('[role="dialog"], [role="alertdialog"]'))
      problems.push("nested panel");
    if (dialog.getAttribute("aria-modal") !== "true")
      problems.push("panel must be modal");
  }
  const published = screen.querySelector(".mokly-viewer");
  const canvas = screen.querySelector(".fo-stage-canvas");
  if (!published && !canvas) problems.push("viewer stage required");
  if (published) {
    if (!published.querySelector(".mbk-brand"))
      problems.push("the viewer carries its mark");
    for (const slot of ["topBarStart", "topBarEnd"])
      if (!published.querySelector('[data-mokly-slot="' + slot + '"]'))
        problems.push("published viewer slot required: " + slot);
    // The stage's phone and browser frames each hold the sample screen.
    for (const device of [".phone-frame", ".browser-frame"])
      if (
        published.querySelectorAll(
          "[data-mokly-stage] " + device + " [data-mkc-sample-screen]",
        ).length !== 1
      )
        problems.push("published viewer frames the sample screen: " + device);
  } else if (!screen.querySelector(".review-brand")) {
    problems.push("the fallback chrome carries the mark");
  }
  const backdrop = screen.querySelector(".fo-viewer-backdrop");
  if (backdrop) {
    if (dialogs.length !== 1) problems.push("an open panel is one dialog");
    if (
      backdrop.getAttribute("aria-hidden") !== "true" ||
      !backdrop.hasAttribute("inert")
    )
      problems.push("the viewer beneath must be inert");
    if (backdrop.querySelector("h1"))
      problems.push("the viewer beneath keeps no primary heading");
  } else if (dialogs.length) {
    problems.push("a viewer entry opens no panel");
  }
  if (!published) {
    const card = canvas?.querySelector(".fo-stage-card");
    if (canvas && !card && (canvas.textContent ?? "").trim())
      problems.push("the ready fallback stage must be empty");
    if (canvas?.querySelector("iframe"))
      problems.push("the fallback stage frames nothing");
  }
  return problems;
}
