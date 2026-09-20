/**
 * One reader and writer for every catalogue disclosure. A collection group is
 * a native `<details>`, while the variant list a screen row discloses is a
 * plain container whose `hidden` attribute carries the same state, because the
 * row beside it is a link and cannot also be a `<summary>`. Both answer to
 * `data-nav-disclosure`, so callers work through these helpers instead of
 * reaching for `.open`.
 */

/** Every navigation disclosure, native group or variant list, in tree order. */
export function navDisclosures(doc: Document): HTMLElement[] {
  return [...doc.querySelectorAll<HTMLElement>("[data-nav-disclosure]")];
}

/**
 * Whether a disclosure is a screen's variant list rather than a `<details>`.
 * Such a list spends `hidden` on its own disclosure, so a caller that hides
 * filtered-out groups must close this one instead of hiding it separately.
 */
export function isVariantList(element: Element): boolean {
  return element.getAttribute("data-nav-variants") !== null;
}

/** Whether one navigation disclosure currently shows its contents. */
export function isDisclosureOpen(element: Element): boolean {
  return isVariantList(element)
    ? !(element as HTMLElement).hidden
    : (element as HTMLDetailsElement).open;
}

/**
 * Open or close one navigation disclosure. A variant list also updates the
 * button that names it, so its pressed state and accessible name keep
 * describing what activating it will do.
 */
export function setDisclosureOpen(element: Element, open: boolean): void {
  if (!isVariantList(element)) {
    (element as HTMLDetailsElement).open = open;
    return;
  }
  (element as HTMLElement).hidden = !open;
  const toggle = variantToggle(element);
  if (!toggle) return;
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  const label = toggle.getAttribute("data-nav-variants-label");
  if (label !== null) {
    toggle.setAttribute(
      "aria-label",
      `${open ? "Hide" : "Show"} variants of ${label}`,
    );
  }
}

/** The button that discloses one variant list, when the row is still there. */
function variantToggle(list: Element): Element | undefined {
  const id = list.getAttribute("id");
  if (id === null) return undefined;
  return (
    list.parentElement?.querySelector(`[data-nav-variants-toggle="${id}"]`) ??
    undefined
  );
}
