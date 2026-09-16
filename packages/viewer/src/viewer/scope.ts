/** Adapt document-oriented enhancements to one isolated viewer root. */
export function runtimeScope(
  root: HTMLElement,
  baseUrl: URL,
  comparisonUrl: string | null,
) {
  const document = root.ownerDocument;
  const window = document.defaultView! as Window & typeof globalThis;
  const cleanup = new Set<() => void>();
  const listeners = new EventTarget();
  const storage = new Map<string, string>();
  const registrations: {
    target: EventTarget;
    name: string;
    original: EventListenerOrEventListenerObject;
    capture: boolean;
    stop: () => void;
  }[] = [];
  let url = new URL(baseUrl),
    state: unknown = {};
  const ignored = (target: EventTarget | null) =>
    target instanceof window.Element &&
    Boolean(target.closest("[data-mokly-slot]"));
  const remove = (
    target: EventTarget,
    name: string,
    original: EventListenerOrEventListenerObject,
    options?: EventListenerOptions | boolean,
  ) => {
    const capture =
      typeof options === "boolean" ? options : Boolean(options?.capture);
    const registration = registrations.find(
      (item) =>
        item.target === target &&
        item.name === name &&
        item.original === original &&
        item.capture === capture,
    );
    registration?.stop();
  };
  const listen = (
    target: EventTarget,
    name: string,
    original: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ) => {
    if (!original) return;
    remove(target, name, original, options);
    const handler = (event: Event) => {
      if (ignored(event.target)) return;
      if (typeof original === "function") original(event);
      else original.handleEvent(event);
    };
    const registration = {
      target,
      name,
      original,
      capture:
        typeof options === "boolean" ? options : Boolean(options?.capture),
      stop: () => {
        target.removeEventListener(name, handler, options);
        cleanup.delete(registration.stop);
        const index = registrations.indexOf(registration);
        if (index !== -1) registrations.splice(index, 1);
      },
    };
    target.addEventListener(name, handler, options);
    registrations.push(registration);
    cleanup.add(registration.stop);
  };
  const queryAll = (selector: string) =>
    [...root.querySelectorAll(selector)].filter(
      (item) => !item.closest("[data-mokly-slot]"),
    );
  const doc = new Proxy(document, {
    get(target, key) {
      if (key === "querySelector")
        return (selector: string) =>
          (root.matches(selector) ? root : queryAll(selector)[0]) ?? null;
      if (key === "querySelectorAll") return queryAll;
      if (key === "getElementById")
        return (id: string) => queryAll(`#${window.CSS.escape(id)}`)[0] ?? null;
      if (key === "body" || key === "documentElement") return root;
      if (key === "URL") return url.href;
      if (key === "defaultView") return win;
      if (key === "addEventListener")
        return (
          name: string,
          fn: EventListener,
          options?: AddEventListenerOptions | boolean,
        ) => listen(root, name, fn, options);
      if (key === "removeEventListener")
        return (
          name: string,
          fn: EventListener,
          options?: EventListenerOptions | boolean,
        ) => remove(root, name, fn, options);
      if (key === "dispatchEvent") return root.dispatchEvent.bind(root);
      const result = Reflect.get(target, key, target);
      return typeof result === "function" ? result.bind(target) : result;
    },
  });
  const history = {
    scrollRestoration: "manual",
    get state() {
      return state;
    },
    pushState(value: unknown, _title: string, next?: string | URL | null) {
      state = value;
      if (next) url = new URL(next, url);
    },
    replaceState(value: unknown, _title: string, next?: string | URL | null) {
      state = value;
      if (next) url = new URL(next, url);
    },
  };
  const eventTarget = (name: string) =>
    ["resize", "blur"].includes(name) ? window : listeners;
  const resource = (input: string | URL) => {
    const request = new URL(input, url);
    if (
      request.origin !== baseUrl.origin ||
      !comparisonUrl ||
      request.pathname !== `/${comparisonUrl}` ||
      request.username ||
      request.password
    )
      throw new Error("The comparison is unavailable.");
    return request;
  };
  const win = new Proxy(window, {
    get(target, key) {
      if (key === "location") return url;
      if (key === "history") return history;
      if (key === "localStorage" || key === "sessionStorage")
        return {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
          removeItem: (key: string) => storage.delete(key),
        };
      if (key === "fetch")
        return async (input: string | URL, init?: RequestInit) => {
          const response = await target.fetch(resource(input), {
            ...init,
            credentials: "omit",
          });
          resource(response.url);
          return response;
        };
      if (key === "addEventListener")
        return (
          name: string,
          fn: EventListener,
          options?: AddEventListenerOptions | boolean,
        ) => listen(eventTarget(name), name, fn, options);
      if (key === "removeEventListener")
        return (
          name: string,
          fn: EventListener,
          options?: EventListenerOptions | boolean,
        ) => remove(eventTarget(name), name, fn, options);
      const value = Reflect.get(target, key, target);
      return typeof value === "function" && !/^[A-Z]/.test(String(key))
        ? value.bind(target)
        : value;
    },
  });
  return {
    doc,
    win,
    setUrl: (next: URL) => {
      url = next;
    },
    dispose: () => {
      for (const stop of cleanup) stop();
    },
  };
}
