import vm from "node:vm";

export function probeHarness(bundle: string, query: string, hasMap = true) {
  const messages: { data: string; origin: string }[] = [];
  const workerMessages: string[] = [];
  const serviceWorker = {
    controller: null as {
      scriptURL: string;
      postMessage(data: string): void;
    } | null,
  };
  const listeners = new Map<string, EventListener>();
  const documentListeners = new Map<string, EventListener>();
  const wheelOptions = new Map<string, AddEventListenerOptions>();
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  let time = 0;
  let inspected = 0,
    observed = 0,
    trapped = 0;
  const parent = {
    postMessage(data: string, origin: string) {
      messages.push({ data, origin });
    },
  };
  Object.defineProperty(parent, "location", {
    get() {
      trapped++;
      throw new Error("parent.location accessed");
    },
  });
  const doc = {
    querySelectorAll() {
      inspected++;
      if (!hasMap) return [];
      return [
        {
          content: {
            textContent: JSON.stringify({
              ranges: [],
              links: [
                { screenPath: "screen", target: { kind: "top" } },
                { screenPath: "screen", target: { kind: "parent" } },
                {
                  screenPath: "screen",
                  target: { kind: "named", name: "preview" },
                },
              ],
            }),
          },
        },
      ];
    },
    addEventListener(
      type: string,
      listener: EventListener,
      options: AddEventListenerOptions,
    ) {
      documentListeners.set(type, listener);
      wheelOptions.set(type, options);
      options.signal?.addEventListener("abort", () =>
        documentListeners.delete(type),
      );
    },
    removeEventListener(type: string) {
      documentListeners.delete(type);
      wheelOptions.delete(type);
    },
    fonts: { addEventListener() {} },
  };
  class Observer {
    observe() {
      observed++;
    }
    disconnect() {}
  }
  class Link {
    ownerDocument = doc;
    constructor(readonly index: number) {}
    closest() {
      return this;
    }
    hasAttribute() {
      return false;
    }
    getAttribute() {
      return String(this.index);
    }
  }
  const win = {
    location: new URL(`https://frames.test/static/screen.html${query}`),
    parent,
    document: doc,
    navigator: { serviceWorker },
    addEventListener(
      type: string,
      listener: EventListener,
      options?: { signal?: AbortSignal },
    ) {
      listeners.set(type, listener);
      options?.signal?.addEventListener("abort", () => listeners.delete(type));
    },
    removeEventListener(type: string) {
      listeners.delete(type);
    },
    requestAnimationFrame(callback: FrameRequestCallback) {
      frames.set(++frameId, callback);
      return frameId;
    },
    cancelAnimationFrame(handle: number) {
      frames.delete(handle);
    },
    AbortController,
    ResizeObserver: Observer,
    MutationObserver: Observer,
  };
  Object.defineProperty(win, "top", {
    get() {
      trapped++;
      throw new Error("window.top accessed");
    },
  });
  vm.runInNewContext(bundle, {
    window: win,
    document: doc,
    URL,
    TextEncoder,
    AbortController,
    HTMLAnchorElement: Link,
    HTMLAreaElement: Link,
    SVGAElement: Link,
  });
  return {
    messages,
    workerMessages,
    listeners,
    documentListeners,
    control(scriptURL: string) {
      serviceWorker.controller = {
        scriptURL,
        postMessage(data) {
          workerMessages.push(data);
        },
      };
    },
    facts: () => ({ inspected, observed, trapped }),
    activate(index: number) {
      let prevented = false;
      documentListeners.get("click")?.({
        type: "click",
        target: new Link(index),
        currentTarget: doc,
        button: 0,
        preventDefault() {
          prevented = true;
        },
      } as unknown as Event);
      return prevented;
    },
    wheel(input: WheelEventInit) {
      let prevented = false;
      documentListeners.get("wheel")?.({
        type: "wheel",
        deltaMode: 0,
        ...input,
        preventDefault() {
          prevented = wheelOptions.get("wheel")?.passive === false;
        },
      } as unknown as Event);
      return prevented;
    },
    flush() {
      time += 17;
      const callbacks = [...frames.values()];
      frames.clear();
      for (const callback of callbacks) callback(time);
    },
    send(
      data: unknown,
      origin = "https://app.test",
      source: unknown = parent,
      ports: unknown[] = [],
    ) {
      listeners.get("message")?.({
        data,
        origin,
        source,
        ports,
      } as unknown as Event);
    },
  };
}
