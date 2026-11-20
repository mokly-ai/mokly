/**
 * Accessibility violations shared state components can introduce at runtime.
 * Every rendered error alert must hold non-whitespace state copy: an empty
 * string or an empty node satisfies the `StateMessage` types but gives a
 * screen reader nothing, so both suites run this on the document.
 */
export function stateDocumentViolations(): string[] {
  const document = globalThis.document;
  const violations: string[] = [];
  const normalized = (text: string | null) =>
    (text ?? "")
      .replace(/\s+/g, " ")
      .replace(/(?:…|\.\.\.)$/, "")
      .trim();

  for (const screen of document.querySelectorAll("[data-mkc-screen]")) {
    const heading = normalized(screen.querySelector("h1")?.textContent ?? null);
    for (const pending of screen.querySelectorAll(
      ".fo-pending-label:not(.fo-sr-only)",
    )) {
      if (heading && normalized(pending.textContent) === heading) {
        violations.push("visible pending label repeats screen heading");
      }
    }
  }

  for (const error of document.querySelectorAll(".fo-state-problem")) {
    const announced = [...error.children].some(
      (child) =>
        child.matches(".fo-state-title, .fo-state-detail, .fo-sr-only") &&
        normalized(child.textContent).length > 0,
    );
    if (!announced) violations.push("error state needs announced copy");
  }

  return violations;
}
