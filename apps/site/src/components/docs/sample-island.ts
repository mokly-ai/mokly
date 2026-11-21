/**
 * The sample island, which `Docs.astro` loads on every docs page. It runs
 * each HTML sample band that `src/docs/sample-band.ts` draws.
 *
 * - It marks the band ready, which shows the controls. Their radios switch
 *   the band to the frame of the chosen viewport and saved state, and dim
 *   the lines that the chosen view does not render.
 * - Pointing at a line or at an element of the view, or tapping it, lights
 *   the line and the element: every line of that element takes its tint,
 *   and a mark with a selection and the element's tag name sits over the
 *   element. While the band sets the frame beside the code, a wire joins the
 *   lit line at the code panel's edge to the element at the frame's edge.
 * - As a view shows, the element that the reader lit last lights again, or
 *   else the view's first heading, so the band rests as its mockup draws it.
 *
 * Each view is a `srcdoc` frame of the site's origin that runs no script, and
 * it takes no pointer: the island reads its document once it has loaded and
 * finds the element under the pointer there. The parts follow resizing and
 * the loaded fonts. Nothing moves, with or without reduced motion. Without
 * script the band shows its first view with its dimmed lines, and without
 * the controls, the marks or the wire.
 */

import { contentBox, inView, placeMark, placeWire } from "./sample-marks.js";
import {
  MARKER,
  type View,
  bandViews,
  check,
  chosen,
  fact,
  loaded,
  rendered,
} from "./sample-views.js";

/** The mark of a band whose island runs, which shows its controls. */
const READY = "data-sample-ready";

/** The classes of a lit line and of a line that the view does not render. */
const LIT = "site-code-line--lit";
const DIM = "site-code-line--dim";

/** The headings of a view, of which the first lights as the view shows. */
const HEADINGS = `:is(h1, h2, h3, h4, h5, h6)[${MARKER}]`;

function start(band: HTMLElement): void {
  const form = band.querySelector<HTMLFormElement>(
    ".site-docs-sample-controls",
  );
  const code = band.querySelector<HTMLElement>(".site-docs-sample-code");
  const stage = band.querySelector<HTMLElement>(".site-docs-sample-stage");
  const wire = band.querySelector<HTMLElement>(".site-docs-sample-wire");
  const views = bandViews(band);
  const lines = [
    ...band.querySelectorAll<HTMLElement>(".site-code-line[data-line]"),
  ];
  const [first] = views;
  if (!form || !code || !stage || !wire || !first) return;

  let shown = views.find((view) => !view.frame.hidden) ?? first;
  // The source line of the element that the reader lit last, and the lit
  // element in the shown view's document.
  let wanted: string | undefined;
  let lit: Element | undefined;

  const draw = () => {
    for (const view of views) view.mark.hidden = true;
    wire.hidden = true;
    const { iframe, mark, screen } = shown;
    const content = loaded(shown);
    const box =
      lit && content && lit.ownerDocument === content
        ? contentBox(lit)
        : undefined;
    if (!lit || !box || !inView(box, iframe)) return;
    const scaled = iframe.getBoundingClientRect();
    const scale = scaled.width / iframe.offsetWidth;
    placeMark(mark, box, scale, lit.localName);
    const line = lines.find((each) => each.classList.contains(LIT));
    const panel = code.getBoundingClientRect();
    const space = stage.getBoundingClientRect();
    // Stacked, the frame sits under the code, and the band draws no wire.
    if (!line || space.left < panel.right) return;
    const from = line.getBoundingClientRect();
    placeWire(
      wire,
      {
        x: panel.right - space.left,
        y: from.top + from.height / 2 - space.top,
      },
      {
        x: screen.getBoundingClientRect().left - space.left,
        y: scaled.top + (box.top + box.height / 2) * scale - space.top,
      },
    );
  };

  const light = (element: Element | undefined) => {
    lit = element;
    const marker = element?.getAttribute(MARKER) ?? undefined;
    for (const line of lines)
      line.classList.toggle(
        LIT,
        marker !== undefined && line.getAttribute(MARKER) === marker,
      );
    draw();
  };

  const pick = (element: Element | null | undefined) => {
    if (!element || element === lit) return;
    wanted = element.getAttribute(MARKER) ?? undefined;
    light(element);
  };

  const relight = () => {
    const content = loaded(shown);
    const kept =
      content && wanted !== undefined ? rendered(content, wanted) : null;
    light(kept ?? content?.querySelector(HEADINGS) ?? undefined);
  };

  const show = (view: View) => {
    shown = view;
    for (const each of views) each.frame.hidden = each !== view;
    stage.classList.toggle(
      "site-docs-sample-stage--desktop",
      fact(view, "viewport") === "desktop",
    );
    const dimmed = new Set(fact(view, "dimmed").split(" "));
    for (const line of lines)
      line.classList.toggle(
        DIM,
        dimmed.has(line.getAttribute("data-line") ?? ""),
      );
    check(form, "viewport", fact(view, "viewport"));
    check(form, "state", fact(view, "state"));
    relight();
  };

  const pointAtLine = (target: EventTarget | null) => {
    const line =
      target instanceof Element ? target.closest(`[${MARKER}]`) : null;
    const marker = line?.getAttribute(MARKER);
    const content = loaded(shown);
    if (marker && content) pick(rendered(content, marker));
  };

  // The view takes no pointer, so its box finds the element under the
  // pointer in the view's own space, which the frame shows at its scale.
  const pointAtView = (view: View, event: MouseEvent) => {
    const content = loaded(view);
    if (view !== shown || !content) return;
    const scaled = view.iframe.getBoundingClientRect();
    const scale = scaled.width / view.iframe.offsetWidth;
    const hit = content.elementFromPoint(
      (event.clientX - scaled.left) / scale,
      (event.clientY - scaled.top) / scale,
    );
    pick(hit?.closest(`[${MARKER}]`));
  };

  code.addEventListener("pointerover", (event) => {
    if (event.pointerType !== "touch") pointAtLine(event.target);
  });
  code.addEventListener("click", (event) => pointAtLine(event.target));
  for (const view of views) {
    view.view.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "touch") pointAtView(view, event);
    });
    view.view.addEventListener("click", (event) => pointAtView(view, event));
    view.iframe.addEventListener("load", () => {
      if (view === shown) relight();
    });
  }
  form.addEventListener("change", (event) => {
    const name =
      event.target instanceof HTMLInputElement ? event.target.name : "";
    show(chosen(form, views, name) ?? shown);
  });
  form.addEventListener("submit", (event) => event.preventDefault());

  let queued = false;
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      draw();
    });
  };
  const resized = new ResizeObserver(queue);
  resized.observe(band);
  resized.observe(code);
  void document.fonts.ready.then(queue);

  // The radios hold the first view, or the choice that the browser restored.
  show(chosen(form, views, "") ?? shown);
  band.setAttribute(READY, "");
}

for (const band of document.querySelectorAll<HTMLElement>(".site-docs-sample"))
  start(band);
