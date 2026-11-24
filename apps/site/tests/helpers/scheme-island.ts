/**
 * Runs the shipped scheme island, `src/components/scheme-island.js`, in a
 * `node:vm` context with a stub page view: the root element, the control's
 * radios, the address, `localStorage`, the system scheme and the frames. A
 * test opens one view for each page load and shares a storage between views.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const SOURCE = readFileSync(
  path.resolve(import.meta.dirname, "../../src/components/scheme-island.js"),
  "utf8",
);

/** A color scheme. */
export type Scheme = "light" | "dark";

/** A stand-in for `localStorage` that keeps its entries in memory. */
export interface MemoryStorage {
  readonly entries: Map<string, string>;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** A storage whose entries the island can read and write. */
export function memoryStorage(): MemoryStorage {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, value),
  };
}

/** A storage whose reads and writes throw, as a full or blocked one does. */
export function throwingStorage(): Omit<MemoryStorage, "entries"> {
  const refuse = (): never => {
    throw new Error("The operation is insecure.");
  };
  return { getItem: refuse, setItem: refuse };
}

/** How a page view starts. */
export interface ViewOptions {
  /** The address's query, such as `?scheme=dark`. */
  readonly search?: string;
  /** The view's `localStorage`, or `unavailable` when reading it throws. */
  readonly storage?: Omit<MemoryStorage, "entries"> | "unavailable";
  /** The system scheme, light by default. */
  readonly system?: Scheme;
}

/** One page view that ran the island in its head. */
export interface View {
  /** The root's attributes, by name. */
  readonly root: ReadonlyMap<string, string>;
  /** What the island threw, which a browser reports while the page stays. */
  readonly errors: readonly unknown[];
  /** The values of the checked radios, in document order. */
  readonly checked: readonly string[];
  /** The parser inserts the control's two radios. */
  insertControl(): void;
  /**
   * The reader presses an option, with the pointer or the arrow keys. As in
   * Chrome, the press fires click, and change only when the option changes.
   */
  press(scheme: Scheme): void;
  /** The system scheme changes. */
  changeSystem(scheme: Scheme): void;
  /** The browser restores an old checked radio into the control. */
  restoreChecked(scheme: Scheme): void;
  /** The browser shows the page, from the back-forward cache if `persisted`. */
  show(persisted: boolean): void;
  /** The browser draws one frame. */
  frame(): void;
}

type Listener = (event: object) => void;

/** Open a page view: run the island as the page head does. */
export function openView(options: ViewOptions = {}): View {
  const root = new Map<string, string>();
  const radios: Radio[] = [];
  const observers = new Set<Observer>();
  const listeners = new Map<string, Listener[]>();
  const errors: unknown[] = [];
  // A browser reports what a script or a callback throws and runs on.
  const report = (run: () => void) => {
    try {
      run();
    } catch (error) {
      errors.push(error);
    }
  };
  const listen = (target: string) => (type: string, listener: Listener) =>
    void listeners.set(`${target} ${type}`, [
      ...(listeners.get(`${target} ${type}`) ?? []),
      listener,
    ]);
  const dispatch = (target: string, type: string, event: object) => {
    for (const listener of listeners.get(`${target} ${type}`) ?? [])
      report(() => listener(event));
  };
  let radioName = "";
  let system = options.system ?? "light";
  let frames: Array<() => void> = [];

  class Radio {
    checked = false;
    constructor(
      readonly name: string,
      readonly value: Scheme,
    ) {}
  }
  class Observer {
    constructor(readonly notify: () => void) {}
    observe(): void {
      observers.add(this);
    }
    disconnect(): void {
      observers.delete(this);
    }
  }

  const stubWindow: Record<string, unknown> = {
    HTMLInputElement: Radio,
    MutationObserver: Observer,
    URLSearchParams,
    addEventListener: listen("window"),
    location: { search: options.search ?? "" },
    matchMedia: (query: string) => {
      const scheme = /^\(prefers-color-scheme: (light|dark)\)$/.exec(query);
      if (!scheme) throw new Error(`The stub page has no query ${query}`);
      return {
        addEventListener: listen("system"),
        get matches() {
          return scheme[1] === system;
        },
      };
    },
    requestAnimationFrame: (callback: () => void) => void frames.push(callback),
  };
  if (options.storage === "unavailable") {
    Object.defineProperty(stubWindow, "localStorage", {
      get: () => {
        throw new Error("Access is denied for this document.");
      },
    });
  } else {
    stubWindow["localStorage"] = options.storage ?? memoryStorage();
  }
  const stubDocument = {
    addEventListener: listen("document"),
    documentElement: {
      removeAttribute: (name: string) => void root.delete(name),
      setAttribute: (name: string, value: string) => void root.set(name, value),
    },
    getElementsByName: (name: string) => {
      radioName = name;
      return radios;
    },
  };
  const context = vm.createContext({
    document: stubDocument,
    window: stubWindow,
  });
  report(() => vm.runInContext(SOURCE, context));

  const radio = (scheme: Scheme) =>
    radios.find((candidate) => candidate.value === scheme);
  return {
    errors,
    root,
    get checked() {
      return radios.filter((each) => each.checked).map((each) => each.value);
    },
    insertControl() {
      radios.push(new Radio(radioName, "light"), new Radio(radioName, "dark"));
      // Mutation callbacks run after the parser's task, before a frame.
      for (const observer of [...observers]) report(observer.notify);
    },
    press(scheme) {
      const target = radio(scheme);
      const changed = target?.checked === false;
      for (const each of radios) each.checked = each === target;
      dispatch("document", "click", { target });
      if (changed) dispatch("document", "change", { target });
    },
    changeSystem(scheme) {
      system = scheme;
      dispatch("system", "change", { matches: scheme === "dark" });
    },
    restoreChecked(scheme) {
      for (const each of radios) each.checked = each.value === scheme;
    },
    show(persisted) {
      dispatch("window", "pageshow", { persisted });
    },
    frame() {
      const due = frames;
      frames = [];
      for (const callback of due) report(callback);
    },
  };
}
