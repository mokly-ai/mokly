/**
 * The views and the controls of an HTML sample band, as the sample island,
 * `sample-island.ts`, reads and sets them: each view's frame with its parts,
 * the view's document once it has loaded, the element that a source line
 * renders there, and the radios of the two controls.
 */

/** The attribute that maps a line, and marks an element, to its source. */
export const MARKER = "data-sample-line";

/** One view's frame and the parts of it that the island reads and sets. */
export interface View {
  /** The frame, which carries the view's viewport, state and dimmed lines. */
  readonly frame: HTMLElement;
  /** The view's own document, scaled down. */
  readonly iframe: HTMLIFrameElement;
  /** The mark over the lit element. */
  readonly mark: HTMLElement;
  /** The drawn screen, whose left edge the wire reaches. */
  readonly screen: HTMLElement;
  /** The box of the document, which takes the pointer for it. */
  readonly view: HTMLElement;
}

/** The views of a band, each frame with all of its parts. */
export function bandViews(band: HTMLElement): View[] {
  return [...band.querySelectorAll<HTMLElement>(".site-docs-sample-frame")]
    .map((frame) => ({
      frame,
      iframe: frame.querySelector("iframe"),
      mark: frame.querySelector<HTMLElement>(".site-docs-sample-mark"),
      screen: frame.querySelector<HTMLElement>(".site-docs-sample-screen"),
      view: frame.querySelector<HTMLElement>(".site-docs-sample-view"),
    }))
    .flatMap(({ frame, iframe, mark, screen, view }) =>
      iframe && mark && screen && view
        ? [{ frame, iframe, mark, screen, view }]
        : [],
    );
}

/** One of a view's facts, which its frame carries. */
export function fact(
  view: View,
  name: "dimmed" | "state" | "viewport",
): string {
  return view.frame.getAttribute(`data-${name}`) ?? "";
}

/**
 * A view's document once it has loaded, rather than the blank document that
 * a lazy frame holds until it shows.
 */
export function loaded(view: View): Document | undefined {
  const content = view.iframe.contentDocument;
  return content?.URL === "about:srcdoc" && content.readyState === "complete"
    ? content
    : undefined;
}

/** The first element of a view's document that a source line renders. */
export function rendered(content: Document, marker: string): Element | null {
  return content.querySelector(`[${MARKER}="${CSS.escape(marker)}"]`);
}

/** The value of the checked radio of one control. */
export function checked(
  form: HTMLFormElement,
  name: "state" | "viewport",
): string {
  return (
    form.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)
      ?.value ?? ""
  );
}

/** Check the radio of one control that holds `value`. */
export function check(
  form: HTMLFormElement,
  name: "state" | "viewport",
  value: string,
): void {
  for (const input of form.querySelectorAll<HTMLInputElement>(
    `input[name="${name}"]`,
  ))
    input.checked = input.value === value;
}

/**
 * The view of the checked viewport and state. When no view has both, the
 * control that changed wins, and the other control then follows the view.
 */
export function chosen(
  form: HTMLFormElement,
  views: readonly View[],
  changed: string,
): View | undefined {
  const viewport = checked(form, "viewport");
  const state = checked(form, "state");
  return (
    views.find(
      (view) =>
        fact(view, "viewport") === viewport && fact(view, "state") === state,
    ) ??
    views.find((view) =>
      changed === "state"
        ? fact(view, "state") === state
        : fact(view, "viewport") === viewport,
    )
  );
}
