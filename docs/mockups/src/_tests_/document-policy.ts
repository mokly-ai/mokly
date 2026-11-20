/** Runs in Chromium on both generated documents and deliberately invalid fixtures. */
export function documentViolations(): string[] {
  const document = globalThis.document;
  const violations: string[] = [];
  const normalized = (text: string | null) =>
    (text ?? "")
      .replace(/\s+/g, " ")
      .replace(/(?:…|\.\.\.)$/, "")
      .trim();
  const screens = [...document.querySelectorAll("[data-mkc-screen]")];
  if (screens.length > 5) violations.push("more than five screens");
  if (
    document.querySelector("[data-child-pages]") &&
    !screens.length &&
    !document.querySelector("[data-catalogue-index]")
  )
    violations.push("non-terminal page needs a canonical screen");
  for (const screen of screens) {
    if (
      screen.querySelector(
        "[data-policy-note], [data-engineering-note], [data-environment]",
      )
    )
      violations.push("annotation inside screen");
    const text = (screen.textContent ?? "").replace(/\s+/g, " ");
    if (
      /TODO:|lorem ipsum|preview environment|sandbox environment|implementation note/i.test(
        text,
      )
    )
      violations.push("engineering copy inside screen");
    const heading = normalized(screen.querySelector("h1")?.textContent ?? null);
    for (const pending of screen.querySelectorAll(
      ".fo-pending-label:not(.fo-sr-only)",
    ))
      if (heading && normalized(pending.textContent) === heading)
        violations.push("visible pending label repeats screen heading");
  }
  for (const error of document.querySelectorAll(".fo-state-problem")) {
    const announced = [...error.children].some(
      (child) =>
        child.matches(".fo-state-title, .fo-state-detail, .fo-sr-only") &&
        normalized(child.textContent).length > 0,
    );
    if (!announced) violations.push("error state needs announced copy");
  }
  if (document.querySelector("[data-catalogue-index] [data-mkc-screen]"))
    violations.push("index contains a product screen");
  const mains = [...document.querySelectorAll("main, [role='main']")].filter(
    (main) => !main.closest("[aria-hidden='true'], [inert]"),
  );
  if (mains.length !== 1) violations.push("one main landmark required");
  if (document.querySelectorAll("h1").length !== 1)
    violations.push("one primary heading required");
  const previous = document.activeElement;
  for (const element of document.querySelectorAll<HTMLElement | SVGElement>(
    '[aria-hidden="true"], [aria-hidden="true"] *',
  )) {
    if (element.closest("[inert]")) continue;
    if (
      element === document.body &&
      !document.body.hasAttribute("tabindex") &&
      !document.body.isContentEditable
    )
      continue;
    element.focus?.({ preventScroll: true });
    if (document.activeElement === element)
      violations.push("aria-hidden subtree accepts focus");
  }
  if (previous instanceof HTMLElement || previous instanceof SVGElement)
    previous.focus({ preventScroll: true });
  for (const backdrop of document.querySelectorAll(".fo-viewer-backdrop"))
    if (!backdrop.hasAttribute("inert"))
      violations.push("the viewer beneath must be inert");
  return violations;
}
