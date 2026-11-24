/**
 * Runs the home demos island's two parts against a stub page. `openSpy`
 * starts the Specs scroll spy of `src/components/home/specs-spy.ts` on the
 * seven rows of the Specs panel, with the sections' places, the window's
 * height, its scroll position, its `scroll`, `resize` and home zoom events
 * and its animation frames. `openDemos` starts the demos of
 * `src/components/home/demos.ts` on demo roots, with the window, its
 * intersection observer and its reduced motion query. A test opens one stub
 * page for each page load.
 */

import assert from "node:assert/strict";

import {
  type DemoBox,
  type DemoEntry,
  startDemos,
} from "../../src/components/home/demos.js";
import { startSpecsSpy } from "../../src/components/home/specs-spy.js";
import { HOME_ZOOM_EVENT } from "../../src/components/home/zoom.js";

/** The sections that the Specs panel links, in its order. */
const SECTIONS = [
  "hero",
  "features",
  "browse",
  "review",
  "edit",
  "foundation",
  "footer",
] as const;

/** A section of the home, by the id that its Specs row links. */
export type Section = (typeof SECTIONS)[number];

/** Where each section's top sits, in CSS pixels below the window's top. */
export type Tops = Readonly<Record<Section, number>>;

/** A row of the stub Specs panel. The built page marks Hero current. */
class StubLink {
  readonly attributes: Map<string, string>;
  readonly classes = new Set<string>();
  readonly classList = {
    toggle: (token: string, force: boolean): boolean => {
      if (force) this.classes.add(token);
      else this.classes.delete(token);
      return force;
    },
  };
  constructor(section: Section) {
    this.attributes = new Map([["href", `#${section}`]]);
    if (section === "hero") {
      this.attributes.set("aria-current", "location");
      this.classes.add("site-panel-row--current");
    }
  }
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
}

/** The page and the window that the spy starts on. */
export interface SpyLayout {
  readonly innerHeight: number;
  readonly scrollHeight: number;
  readonly scrollY: number;
  readonly tops: Tops;
}

/** The stub page after the spy started on it, and what a browser does. */
export interface SpyStub {
  /** The sections whose rows carry `aria-current="location"`, and the class. */
  current(): { readonly attribute: Section[]; readonly class: Section[] };
  /** The browser runs the animation frames that are due, and counts them. */
  frame(): number;
  /** The reader scrolls: the sections move, and the window fires `scroll`. */
  scroll(tops: Tops, scrollY: number): void;
  /** The window takes a new height and fires `resize`. */
  resize(innerHeight: number): void;
  /** The home's zoom pill zooms the page: the sections move, and it says so. */
  zoom(tops: Tops): void;
}

/** Open a stub home in `layout`, and start the Specs scroll spy on it. */
export function openSpy(layout: SpyLayout): SpyStub {
  let { innerHeight, scrollY, tops } = layout;
  const links = SECTIONS.map((section) => new StubLink(section));
  const listeners: Record<
    "resize" | "scroll" | typeof HOME_ZOOM_EVENT,
    Array<() => void>
  > = {
    [HOME_ZOOM_EVENT]: [],
    resize: [],
    scroll: [],
  };
  let frames: Array<() => void> = [];
  const document = {
    documentElement: { scrollHeight: layout.scrollHeight },
    getElementById: (id: string) =>
      SECTIONS.includes(id as Section)
        ? { getBoundingClientRect: () => ({ top: tops[id as Section] }) }
        : null,
    querySelectorAll: () => links,
  };
  const window = {
    get innerHeight() {
      return innerHeight;
    },
    get scrollY() {
      return scrollY;
    },
    addEventListener: (
      type: "resize" | "scroll" | typeof HOME_ZOOM_EVENT,
      listener: () => void,
    ) => {
      listeners[type].push(listener);
    },
    requestAnimationFrame: (callback: () => void) => {
      frames.push(callback);
      return frames.length;
    },
  };
  startSpecsSpy(document, window);
  const marked = (has: (link: StubLink) => boolean): Section[] =>
    SECTIONS.filter((_, index) => has(links[index]!));
  return {
    current: () => ({
      attribute: marked(
        (link) => link.getAttribute("aria-current") === "location",
      ),
      class: marked((link) => link.classes.has("site-panel-row--current")),
    }),
    frame: () => {
      const due = frames;
      frames = [];
      for (const callback of due) callback();
      return due.length;
    },
    scroll: (next, nextScrollY) => {
      tops = next;
      scrollY = nextScrollY;
      for (const listener of listeners.scroll) listener();
    },
    resize: (next) => {
      innerHeight = next;
      for (const listener of listeners.resize) listener();
    },
    zoom: (next) => {
      tops = next;
      for (const listener of listeners[HOME_ZOOM_EVENT]) listener();
    },
  };
}

/** The root of a stub demo, with the state that the island gives it. */
export class StubRoot {
  readonly attributes = new Map<string, string>();
  constructor(readonly box: DemoBox) {}
  getBoundingClientRect(): DemoBox {
    return this.box;
  }
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  get state(): string | undefined {
    return this.attributes.get("data-home-demo-state");
  }
}

/** A demo `height` pixels tall whose top sits `top` below the window's top. */
export function stubDemo(top: number, height: number): StubRoot {
  return new StubRoot({ bottom: top + height, left: 0, right: 1080, top });
}

/** The window that the demos start in. */
export interface DemoSetting {
  readonly innerHeight: number;
  readonly observer?: boolean;
  readonly reduced?: boolean;
}

/** The stub page after the demos started on it, and what a browser does. */
export interface DemosStub {
  /** How many observers the island made. */
  readonly made: number;
  /** The roots that the observer watches. */
  observed(): readonly StubRoot[];
  /** The observer reports how much of `target` is in view. */
  report(target: StubRoot, ratio: number, height: number): void;
  /** The reader asks for reduced motion while the page is open. */
  reduceMotion(): void;
}

/** Open a stub home with the demo `roots`, and start the demos on it. */
export function openDemos(
  roots: readonly StubRoot[],
  setting: DemoSetting,
): DemosStub {
  let reduced = setting.reduced ?? false;
  const changes: Array<() => void> = [];
  let made = 0;
  let watched = new Set<StubRoot>();
  let report: (entries: readonly DemoEntry<StubRoot>[]) => void = () => {};
  class Observer {
    constructor(callback: (entries: readonly DemoEntry<StubRoot>[]) => void) {
      made += 1;
      report = callback;
    }
    disconnect(): void {
      watched = new Set();
    }
    observe(target: StubRoot): void {
      watched.add(target);
    }
    unobserve(target: StubRoot): void {
      watched.delete(target);
    }
  }
  const window = {
    ...(setting.observer === false ? {} : { IntersectionObserver: Observer }),
    innerHeight: setting.innerHeight,
    innerWidth: 1440,
    matchMedia: (query: string) => {
      assert.equal(query, "(prefers-reduced-motion: reduce)");
      return {
        get matches() {
          return reduced;
        },
        addEventListener: (_type: "change", listener: () => void) => {
          changes.push(listener);
        },
      };
    },
  };
  startDemos({ querySelectorAll: () => roots }, window);
  return {
    get made() {
      return made;
    },
    observed: () => [...watched],
    report: (target, ratio, height) => {
      if (!watched.has(target)) return;
      report([
        {
          intersectionRatio: ratio,
          intersectionRect: { height },
          isIntersecting: ratio > 0,
          target,
        },
      ]);
    },
    reduceMotion: () => {
      reduced = true;
      for (const listener of changes) listener();
    },
  };
}
