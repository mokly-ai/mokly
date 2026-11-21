/**
 * The demos of the home demos island. Each home section draws its demo in
 * CSS, and the root of each demo, the section's `ModuleFrame`, carries
 * `data-home-demo` with the demo's name. The built page draws every demo in
 * its finished state, which the section's base rules hold.
 *
 * With motion allowed, the island arms each demo that is out of view at
 * start: it sets `data-home-demo-state="armed"`, and the section's sheet
 * draws the demo's start state under that value. Once an armed demo comes
 * into view, the island sets `"play"` once, and the sheet runs the demo's
 * keyframes from the start state to the finished state under that value,
 * with `animation-fill-mode: backwards`: when the keyframes end, the base
 * rules draw the finished state again, so no finished animation keeps a
 * layer of its own that changes how the text renders. A demo that is in
 * view at start stays as built. Under `prefers-reduced-motion: reduce` the
 * island sets no state, and a guard in `src/styles/home.css` turns every
 * animation under a demo off. `home-island.ts` starts the demos on the home.
 */

/** The attribute that names a demo on its root. */
const DEMO = "data-home-demo";

/** The attribute that holds a demo's state while the island runs it. */
const STATE = "data-home-demo-state";

/** The query of a reader who asks for reduced motion. */
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * How much of a demo is in view when it plays. A demo taller than the
 * window plays once it fills that share of the window's height instead.
 */
const SHARE = 0.35;

/** The ratios at which the observer reports a demo, up to `SHARE`. */
const THRESHOLDS: readonly number[] = [
  0,
  0.05,
  0.1,
  0.15,
  0.2,
  0.25,
  0.3,
  SHARE,
];

/** The home's demos, each named on its root. */
export type HomeDemo = "browse" | "edit" | "foundation" | "review";

/** The attributes that make an element the root of the demo `name`. */
export function demoRoot(
  name: HomeDemo,
): Readonly<Record<typeof DEMO, HomeDemo>> {
  return { [DEMO]: name };
}

/** A box as `getBoundingClientRect()` gives it, in CSS pixels. */
export interface DemoBox {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

/** The root of a demo. */
export interface DemoRoot {
  getBoundingClientRect(): DemoBox;
  removeAttribute(name: string): void;
  setAttribute(name: string, value: string): void;
}

/** What the observer reports about one demo. */
export interface DemoEntry<Root extends DemoRoot> {
  readonly intersectionRatio: number;
  readonly intersectionRect: { readonly height: number };
  readonly isIntersecting: boolean;
  readonly target: Root;
}

/** The observer of the demos that wait to play. */
export interface DemoObserver<Root extends DemoRoot> {
  disconnect(): void;
  observe(target: Root): void;
  unobserve(target: Root): void;
}

/** The page, as the island reads it. */
export interface DemoPage<Root extends DemoRoot> {
  querySelectorAll(selectors: string): Iterable<Root>;
}

/** The window, as the island uses it. */
export interface DemoWindow<Root extends DemoRoot> {
  readonly IntersectionObserver?: new (
    callback: (entries: readonly DemoEntry<Root>[]) => void,
    options: { readonly threshold: number[] },
  ) => DemoObserver<Root>;
  readonly innerHeight: number;
  readonly innerWidth: number;
  matchMedia(query: string): {
    readonly matches: boolean;
    addEventListener(type: "change", listener: () => void): void;
  };
}

/**
 * Arm the demos that are out of view, and play each one once it comes into
 * view: the demos' one entry, which `home-island.ts` calls with the page's
 * `document` and `window`.
 */
export function startDemos<Root extends DemoRoot>(
  document: DemoPage<Root>,
  window: DemoWindow<Root>,
): void {
  const reduced = window.matchMedia(REDUCED_MOTION);
  const Observer = window.IntersectionObserver;
  if (reduced.matches || Observer === undefined) return;

  const armed: Root[] = [];
  for (const root of document.querySelectorAll(`[${DEMO}]`)) {
    const { bottom, left, right, top } = root.getBoundingClientRect();
    const inView =
      bottom > 0 &&
      top < window.innerHeight &&
      right > 0 &&
      left < window.innerWidth;
    if (inView) continue;
    root.setAttribute(STATE, "armed");
    armed.push(root);
  }
  if (armed.length === 0) return;

  const observer = new Observer(
    (entries) => {
      for (const entry of entries) {
        const shown =
          entry.intersectionRatio >= SHARE ||
          entry.intersectionRect.height >= SHARE * window.innerHeight;
        if (!entry.isIntersecting || !shown) continue;
        entry.target.setAttribute(STATE, "play");
        observer.unobserve(entry.target);
      }
    },
    { threshold: [...THRESHOLDS] },
  );
  for (const root of armed) observer.observe(root);

  // A reader who asks for reduced motion while a demo waits sees every demo
  // finished at once: the base rules draw that state.
  reduced.addEventListener("change", () => {
    if (!reduced.matches) return;
    observer.disconnect();
    for (const root of armed) root.removeAttribute(STATE);
  });
}
