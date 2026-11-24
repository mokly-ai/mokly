/**
 * The Specs scroll spy of the home demos island. The Specs panel of the
 * home workspace lists the page's sections as in-page links, and the spy
 * marks the link of the section in view as the current location: the last
 * section whose top has passed 45% of the window's height, or the last
 * link, Footer, once the page is scrolled to its end. It moves
 * `aria-current` and the current class from row to row, and it never moves
 * focus. It reads the layout again on scroll, on resize and after a press
 * of the home's zoom pill, at most once in an animation frame.
 * `home-island.ts` starts it on the home.
 */
import { HOME_ZOOM_EVENT } from "./zoom.js";

/** The panel's links: each one leads to the section that its hash names. */
const LINKS = ".site-home-specs a[href^='#']";

/** The class of the current row, which `PanelRow.astro` sets for `current`. */
const CURRENT_CLASS = "site-panel-row--current";

/** The `aria-current` value of the row of the section in view. */
const CURRENT = "location";

/** How far down the window a section's top passes to be in view. */
const LINE = 0.45;

/** How near the end of the page, in CSS pixels, counts as its end. */
const END = 4;

/** A row of the Specs panel: a link to one section. */
export interface SpyLink {
  readonly classList: { toggle(token: string, force: boolean): unknown };
  getAttribute(name: string): string | null;
  removeAttribute(name: string): void;
  setAttribute(name: string, value: string): void;
}

/** A section of the page, which a row links. */
export interface SpySection {
  getBoundingClientRect(): { readonly top: number };
}

/** The page, as the spy reads it. */
export interface SpyPage {
  readonly documentElement: { readonly scrollHeight: number };
  getElementById(id: string): SpySection | null;
  querySelectorAll(selectors: string): Iterable<SpyLink>;
}

/** The window, as the spy uses it. */
export interface SpyWindow {
  readonly innerHeight: number;
  readonly scrollY: number;
  addEventListener(
    type: "resize" | "scroll" | typeof HOME_ZOOM_EVENT,
    listener: () => void,
    options?: { readonly passive: boolean },
  ): void;
  requestAnimationFrame(callback: () => void): unknown;
}

/**
 * Mark the row of the section in view, and keep the mark in step with the
 * reader's scrolling: the spy's one entry, which `home-island.ts` calls
 * with the page's `document` and `window`.
 */
export function startSpecsSpy(document: SpyPage, window: SpyWindow): void {
  const rows: Array<{ readonly link: SpyLink; readonly section: SpySection }> =
    [];
  for (const link of document.querySelectorAll(LINKS)) {
    const id = link.getAttribute("href")?.slice(1) ?? "";
    const section = document.getElementById(id);
    if (section !== null) rows.push({ link, section });
  }
  const first = rows[0];
  const last = rows.at(-1);
  if (first === undefined || last === undefined) return;

  let current: SpyLink | undefined;
  const mark = (link: SpyLink) => {
    if (link === current) return;
    current = link;
    for (const row of rows) {
      const on = row.link === link;
      row.link.classList.toggle(CURRENT_CLASS, on);
      if (on) row.link.setAttribute("aria-current", CURRENT);
      else row.link.removeAttribute("aria-current");
    }
  };

  let pending = false;
  const update = () => {
    pending = false;
    const end =
      window.scrollY + window.innerHeight >=
      document.documentElement.scrollHeight - END;
    if (end) {
      mark(last.link);
      return;
    }
    const line = window.innerHeight * LINE;
    let inView = first;
    for (const row of rows) {
      if (row.section.getBoundingClientRect().top <= line) inView = row;
    }
    mark(inView.link);
  };
  const schedule = () => {
    if (pending) return;
    pending = true;
    window.requestAnimationFrame(update);
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  window.addEventListener(HOME_ZOOM_EVENT, schedule);
  schedule();
}
