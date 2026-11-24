/**
 * The docs scroll spy. It marks the heading in view: its On this page rows
 * take `aria-current="location"`, and the `h2` section that holds it takes
 * `data-current`, which turns its hanging index green. It also shows how far
 * the reader has come through the page frame, as the width of the progress
 * bar and a percentage.
 *
 * The heading in view is the last listed `h2` or `h3` whose top has passed
 * the reading line, or the first one while none has, as the page reads from
 * its top. The reading line sits a little below the place where an anchor
 * jump lands a heading, so a heading reached from On this page is the one
 * marked. The built page marks no row; this island marks one as it loads.
 */

/** How far down the window below the anchor offset the reading line sits. */
const READING_LINE = 0.22;

const body = document.querySelector<HTMLElement>(
  ".site-docs-frame .site-document-body",
);
const sheet = document.querySelector<HTMLElement>(
  ".site-docs-frame .site-page-sheet",
);

/** The offset of a pixel length that a computed style gives. */
function pixels(value: string): number {
  const length = Number.parseFloat(value);
  return Number.isFinite(length) ? length : 0;
}

if (body && sheet) {
  const headings = [
    ...body.querySelectorAll<HTMLElement>(":scope > h2[id], :scope > h3[id]"),
  ];
  // The position of the `h2` that opens the section of each heading.
  let opened = -1;
  const sections = headings.map((heading, at) =>
    heading.tagName === "H2" ? (opened = at) : opened,
  );
  const links = [
    ...document.querySelectorAll<HTMLAnchorElement>(".site-onpage-link"),
  ];
  const meters = [
    ...document.querySelectorAll<HTMLElement>(".site-docs-progress"),
  ].map((meter) => ({
    fill: meter.querySelector<HTMLElement>(".site-docs-progress-fill"),
    value: meter.querySelector<HTMLElement>(".site-docs-progress-value"),
  }));

  // Where an anchor jump lands a heading: the root's scroll padding, which
  // clears the tool bar, and the heading's own scroll margin.
  let offset = 0;
  const measure = () => {
    const root = pixels(
      getComputedStyle(document.documentElement).scrollPaddingTop,
    );
    const first = headings[0];
    offset =
      root + (first ? pixels(getComputedStyle(first).scrollMarginTop) : 0);
  };

  let shown = -1;
  let percent = -1;
  const mark = (index: number) => {
    if (index === shown) return;
    shown = index;
    const id = headings[index]?.id;
    for (const link of links) {
      if (id !== undefined && link.getAttribute("href") === `#${id}`) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    }
    const section = sections[index] ?? -1;
    headings.forEach((heading, at) => {
      if (heading.tagName === "H2") {
        heading.toggleAttribute("data-current", at === section);
      }
    });
  };

  const show = (progress: number) => {
    const next = Math.round(progress * 100);
    if (next === percent) return;
    percent = next;
    for (const { fill, value } of meters) {
      if (fill) fill.style.transform = `scaleX(${progress.toFixed(3)})`;
      if (value) value.textContent = `${next}%`;
    }
  };

  const update = () => {
    const line = offset + (window.innerHeight - offset) * READING_LINE;
    let index = 0;
    for (const [at, heading] of headings.entries()) {
      if (heading.getBoundingClientRect().top > line) break;
      index = at;
    }
    mark(index);
    const frame = sheet.getBoundingClientRect();
    const span = frame.height - (window.innerHeight - offset);
    show(span > 0 ? Math.min(1, Math.max(0, (offset - frame.top) / span)) : 1);
  };

  let queued = false;
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      update();
    });
  };

  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", () => {
    measure();
    queue();
  });
  void document.fonts.ready.then(queue);
  measure();
  update();
}
