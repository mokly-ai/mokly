import { readCurrentPath } from "../src/catalogue/path_values.js";
import type { CatalogueUsage } from "../src/catalogue/types.js";
import type {
  InstanceBoundary,
  MountedFrame,
} from "../src/client/frame_adapter.js";
import type { ShellFrameSession } from "../src/shell/frame_registry.js";

interface Deferred<T> {
  promise: Promise<T>;
  reject(error: unknown): void;
  resolve(value: T): void;
}

export function deferred<T>(): Deferred<T> {
  let reject = (_error: unknown): void => undefined;
  let resolve = (_value: T): void => undefined;
  const promise = new Promise<T>((complete, fail) => {
    reject = fail;
    resolve = complete;
  });
  return { promise, reject, resolve };
}

export function boundary(key: string): InstanceBoundary {
  return { key, ranges: [] };
}

export function mountedFrame(
  listInstanceBoundaries: MountedFrame["listInstanceBoundaries"],
): MountedFrame {
  return {
    dispose() {},
    async highlight() {},
    listInstanceBoundaries,
    async scrollTo() {},
    subscribe: () => () => {},
  };
}

export function frameSession(mounted: MountedFrame): ShellFrameSession {
  return {
    controller: new AbortController(),
    element: {} as HTMLIFrameElement,
    generation: 1,
    identity: {
      colorScheme: "light",
      entryPath: "screen",
      viewport: "desktop",
    },
    mounted,
    ready: Promise.resolve(mounted),
    source: "/screen.html",
    status: "ready",
    usage: usage(),
    usageRevision: 0,
  };
}

export function usage(): CatalogueUsage {
  const key = "a".repeat(64);
  return {
    status: "ready",
    instances: [
      {
        componentId: readCurrentPath("component"),
        id: "instance",
        key,
        order: 0,
        owner: { kind: "entry" },
        props: {},
        propsKey: "props",
      },
    ],
    ranges: [{ id: "r-0", target: { kind: "instance", instanceKey: key } }],
    slots: [],
  };
}

export function animationFrames(): {
  flush(): void;
  resizeDisconnects(): number;
  resizeObservations(): number;
  root: HTMLElement;
} {
  let sequence = 0;
  let disconnects = 0;
  let observations = 0;
  const pending = new Map<number, FrameRequestCallback>();
  class MutationObserver {
    disconnect() {}
    observe() {}
  }
  class ResizeObserver {
    disconnect() {
      disconnects += 1;
    }
    observe() {
      observations += 1;
    }
  }
  const root = {
    addEventListener() {},
    classList: { remove() {}, toggle() {} },
    ownerDocument: {
      defaultView: {
        addEventListener() {},
        cancelAnimationFrame(id: number) {
          pending.delete(id);
        },
        Element: class {},
        MutationObserver,
        removeEventListener() {},
        requestAnimationFrame(callback: FrameRequestCallback) {
          const id = ++sequence;
          pending.set(id, callback);
          return id;
        },
        ResizeObserver,
      },
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    removeEventListener() {},
  } as unknown as HTMLElement;
  return {
    root,
    flush() {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback(performance.now());
    },
    resizeDisconnects: () => disconnects,
    resizeObservations: () => observations,
  };
}

export function settle(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
