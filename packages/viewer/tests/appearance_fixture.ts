import type {
  AppearanceDocument,
  AppearanceWindow,
} from "../src/standalone/startup.js";

interface FakeFrame {
  src: string;
  dataset: Record<string, string | undefined>;
  getAttribute(name: "src"): string | null;
  loads: string[];
  schemesAtLoad: string[];
  scheme: string;
  closest(selector: string): {
    setAttribute(name: string, value: string): void;
  };
}

export function frame(light: string, dark?: string): FakeFrame {
  let source = light;
  let scheme = "light";
  return {
    get src() {
      return new URL(source, "https://catalogue.example/static/").href;
    },
    set src(value: string) {
      source = value;
      this.loads.push(value);
      this.schemesAtLoad.push(scheme);
    },
    dataset: dark ? { fragmentLight: light, fragmentDark: dark } : {},
    getAttribute: () => source,
    loads: [],
    schemesAtLoad: [],
    get scheme() {
      return scheme;
    },
    closest: () => ({
      setAttribute(_name, value) {
        scheme = value;
      },
    }),
  };
}

export function environment(
  options: {
    search?: string;
    stored?: string | null;
    initial?: string;
    systemDark?: boolean;
    frames?: FakeFrame[];
    opted?: boolean;
    failStorage?: boolean;
  } = {},
) {
  const root: { attributes: Record<string, string> } = { attributes: {} };
  const listeners: { type: string; handler: () => void }[] = [];
  const media = {
    matches: options.systemDark ?? false,
    addEventListener(type: string, handler: () => void) {
      listeners.push({ type, handler });
    },
    removeEventListener(type: string, handler: () => void) {
      const index = listeners.findIndex((entry) => entry.handler === handler);
      if (index >= 0) listeners.splice(index, 1);
    },
  };
  let value = options.stored ?? null;
  const body: { attributes: Record<string, string> } = { attributes: {} };
  const select = {
    value: "auto",
    hidden: true,
    attributes: {} as Record<string, string>,
    handlers: [] as (() => void)[],
    setAttribute(name: string, next: string) {
      select.attributes[name] = next;
    },
    addEventListener(_type: string, handler: () => void) {
      select.handlers.push(handler);
    },
    removeEventListener(_type: string, handler: () => void) {
      const index = select.handlers.indexOf(handler);
      if (index >= 0) select.handlers.splice(index, 1);
    },
    fire() {
      for (const handler of select.handlers) handler();
    },
  };
  let attached: { frames?: FakeFrame[]; body?: boolean; select?: boolean } = {};
  const document = {
    body: undefined as unknown,
    documentElement: {
      getAttribute: (name: string) => root.attributes[name] ?? null,
      setAttribute: (name: string, next: string) => {
        root.attributes[name] = next;
      },
      dataset: options.opted === false ? {} : { moklyAppearance: "" },
    },
    querySelectorAll: (selector: string) =>
      selector.includes("appearance-")
        ? attached.select
          ? [select]
          : []
        : (attached.frames ?? options.frames ?? []),
  } as unknown as AppearanceDocument;
  const window = {
    location: { search: options.search ?? "" },
    matchMedia: () => media,
    localStorage: {
      getItem: () => {
        if (options.failStorage) throw new Error("blocked");
        return value;
      },
      setItem: (_key: string, next: string) => {
        if (options.failStorage) throw new Error("blocked");
        value = next;
      },
      removeItem: () => {
        if (options.failStorage) throw new Error("blocked");
        value = null;
      },
    },
  } as unknown as AppearanceWindow;
  if (options.initial) root.attributes["data-mokly-theme"] = options.initial;
  const attach = (next: typeof attached): void => {
    attached = next;
    if (next.body)
      (document as unknown as { body: unknown }).body = {
        setAttribute: (name: string, value: string) => {
          body.attributes[name] = value;
        },
      };
  };
  return {
    document,
    window,
    root,
    body,
    select,
    attach,
    listeners,
    media,
    stored: () => value,
  };
}
