/**
 * What the viewer's browser checks measure inside a drawn page. Each function
 * runs in the page through `page.evaluate`, so it reads only the document and
 * the argument it is given.
 */

/**
 * Elements painted with the one solid accent a screen is allowed to spend,
 * including a fill drawn by the element's own `::before`, which is where the
 * published viewer paints its selected row. A status dot carries the accent
 * as state rather than as an action, so it is measured out of the budget by
 * its size, as the tokens contract says.
 */
export function accentFills(fill: string) {
  return [...document.querySelectorAll("*")].filter((node) => {
    if (
      getComputedStyle(node).backgroundColor !== fill &&
      getComputedStyle(node, "::before").backgroundColor !== fill
    )
      return false;
    const box = node.getBoundingClientRect();
    return box.width > 16 || box.height > 16;
  }).length;
}

/**
 * Pairs of chrome items that share space in one slot of the top bar. The bar
 * keeps one row: its variable labels truncate and its fixed controls keep
 * their size, so an overlap means the composition failed at that size.
 */
export function overlappingChrome() {
  const overlaps: string[] = [];
  for (const row of document.querySelectorAll(".fo-top-slot")) {
    const boxes = [...row.children].map((node) => node.getBoundingClientRect());
    for (let a = 0; a < boxes.length; a += 1)
      for (let b = a + 1; b < boxes.length; b += 1)
        if (
          boxes[a].right > boxes[b].left + 1 &&
          boxes[b].right > boxes[a].left + 1 &&
          boxes[a].bottom > boxes[b].top + 1 &&
          boxes[b].bottom > boxes[a].top + 1
        )
          overlaps.push(row.className + " " + a + "/" + b);
  }
  return overlaps;
}

/**
 * The frames of a drawn canvas that do not stand clear on it: each frame must
 * lie inside the canvas and clear of each floating part over it that shows,
 * the floating catalogue, the right panel, the zoom pill, the entry bar and
 * the dock. A frame's label stands above its box, so only the box is
 * measured.
 */
export function canvasFrameViolations() {
  const canvas = document.querySelector("[data-mokly-stage]");
  if (!canvas) return ["canvas required"];
  const bounds = canvas.getBoundingClientRect();
  const covers = [
    ...document.querySelectorAll(
      "[data-floating-panel], .mbk-zoom-pill, [data-entry-bar], [data-canvas-dock]",
    ),
  ].filter((node) => node.getClientRects().length > 0);
  const problems: string[] = [];
  for (const frame of canvas.querySelectorAll("[data-canvas-frame]")) {
    const box = frame.getBoundingClientRect();
    const name = frame.querySelector("figcaption")?.textContent ?? "frame";
    if (
      box.width === 0 ||
      box.left < bounds.left ||
      box.right > bounds.right ||
      box.top < bounds.top ||
      box.bottom > bounds.bottom
    )
      problems.push(name + " leaves the canvas");
    for (const cover of covers) {
      const other = cover.getBoundingClientRect();
      if (
        box.left < other.right &&
        other.left < box.right &&
        box.top < other.bottom &&
        other.top < box.bottom
      )
        problems.push(name + " runs under " + cover.className);
    }
  }
  return problems;
}

/**
 * The reference label's lines and the boundaries that can clip its chevron,
 * the last glyph that the trigger draws.
 */
export function referenceTriggerLayout(trigger: Element) {
  const label = trigger.querySelector("[dir=auto]");
  const icons = trigger.querySelectorAll("svg");
  const icon = icons[icons.length - 1];
  const chevron = icon?.getBoundingClientRect();
  const bar = trigger.closest(".fo-top-bar, .mokly-top-host");
  const inside = (boundary: DOMRect | undefined) =>
    Boolean(
      chevron &&
      boundary &&
      chevron.width > 0 &&
      chevron.height > 0 &&
      chevron.left >= boundary.left - 0.5 &&
      chevron.right <= boundary.right + 0.5 &&
      chevron.top >= boundary.top - 0.5 &&
      chevron.bottom <= boundary.bottom + 0.5,
    );
  const clippingAncestors: string[] = [];
  for (let node = icon?.parentElement; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    const box = node.getBoundingClientRect();
    const left = box.left + node.clientLeft;
    const top = box.top + node.clientTop;
    if (
      chevron &&
      ((style.overflowX !== "visible" &&
        (chevron.left < left - 0.5 ||
          chevron.right > left + node.clientWidth + 0.5)) ||
        (style.overflowY !== "visible" &&
          (chevron.top < top - 0.5 ||
            chevron.bottom > top + node.clientHeight + 0.5)))
    )
      clippingAncestors.push(node.className || node.tagName);
    if (node === bar) break;
  }
  return {
    labelLines: label
      ? Math.round(
          label.getBoundingClientRect().height /
            Number.parseFloat(getComputedStyle(label).lineHeight),
        )
      : 0,
    chevronInsideTrigger: inside(trigger.getBoundingClientRect()),
    chevronInsideBar: inside(bar?.getBoundingClientRect()),
    chevronClippingAncestors: clippingAncestors,
  };
}

/** Overflow or multiline labels within the package's fixed-height top bar. */
export function topBarViolations() {
  const bar = document.querySelector<HTMLElement>(".mokly-top-host");
  if (!bar) return ["missing top bar"];
  const boundary = bar.getBoundingClientRect();
  const problems: string[] = [];
  if (bar.scrollWidth > bar.clientWidth + 1) problems.push("horizontal scroll");
  for (const slot of bar.querySelectorAll<HTMLElement>(".fo-top-slot")) {
    const box = slot.getBoundingClientRect();
    if (box.top < boundary.top - 1 || box.bottom > boundary.bottom + 1)
      problems.push("slot leaves the bar");
    for (const label of slot.querySelectorAll<HTMLElement>("[dir=auto]")) {
      const lineHeight = Number.parseFloat(getComputedStyle(label).lineHeight);
      if (label.getBoundingClientRect().height > lineHeight + 1)
        problems.push("label wraps");
    }
  }
  return problems;
}

/**
 * Where a refused request put its parts in the card that holds it: anything
 * that passes the card's edge, the order of the refusal, the control and the
 * reference, and where the guide stands beside the control.
 */
export function refusalLayout(card: Element) {
  const edge = card.getBoundingClientRect();
  const outside = [...card.querySelectorAll("*")]
    .filter((node) => {
      const box = node.getBoundingClientRect();
      return (
        (box.width > 0 || box.height > 0) &&
        (box.left < edge.left - 0.5 || box.right > edge.right + 0.5)
      );
    })
    .map((node) => node.tagName + "." + (node.getAttribute("class") ?? ""));
  const fragment = card.querySelector(".fo-write-failure");
  const box = (selector: string) =>
    fragment?.querySelector(selector)?.getBoundingClientRect();
  const refusal = box("[role=alert]");
  const control = box("[data-testid^=firna-button]");
  const details = box("details");
  const guide = box(".fo-site-link");
  const order: string[] = [];
  if (refusal && control && refusal.bottom <= control.top)
    order.push("refusal above the control");
  if (control && details && control.bottom <= details.top)
    order.push("control above the reference");
  let place = "none";
  if (guide && control && details && guide.bottom <= details.top)
    place =
      guide.left >= control.right &&
      guide.top < control.bottom &&
      guide.bottom > control.top
        ? "beside the control"
        : guide.top >= control.bottom
          ? "beneath the control"
          : "overlapping the control";
  else if (guide) place = "below the reference";
  return { outside, order, guide: place };
}

/**
 * The outline a focused title draws, and whether its box hugs its own text,
 * so the outline goes round the words rather than the whole column.
 */
export function focusOutline(title: Element) {
  const style = getComputedStyle(title);
  const words = document.createRange();
  words.selectNodeContents(title);
  return {
    style: style.outlineStyle,
    width: style.outlineWidth,
    color: style.outlineColor,
    offset: style.outlineOffset,
    radius: style.borderTopLeftRadius,
    hugsText:
      Math.abs(
        words.getBoundingClientRect().width -
          title.getBoundingClientRect().width,
      ) <= 1,
  };
}
