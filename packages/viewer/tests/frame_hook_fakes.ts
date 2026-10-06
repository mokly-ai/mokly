/** Fake frame adapter state and mounts for React frame lifecycle tests. */

import type { Root } from "react-dom/client";

import type { CatalogueUsage } from "../src/catalogue/types.js";
import type {
  FrameAdapter,
  MountedFrame,
} from "../src/client/frame_adapter.js";
import type { ComponentViewRecord } from "../src/components/manifest_types.js";
import type { ShellFrameRegistry } from "../src/shell/frame_registry.js";

/** Promise settled explicitly by a test step. */
export interface Deferred<T> {
  promise: Promise<T>;
  reject(error: unknown): void;
  resolve(value: T): void;
}

/** One rendered frame owner and the fake adapter state it records. */
export interface HookHost {
  activeSubscriptions: number;
  adapter: FrameAdapter;
  deferredMount: boolean;
  deferredUpdates: boolean;
  disposals: number;
  documentIdentity: number;
  element: HTMLElement;
  mounts: number;
  previewUsage?: ComponentViewRecord;
  pendingMounts: Deferred<MountedFrame>[];
  pendingUpdates: Deferred<void>[];
  registry: ShellFrameRegistry | undefined;
  root: Root;
  source: string;
  status: string;
  strict: boolean;
  supportsUsageUpdates: boolean;
  updateStatuses: string[];
  usage: CatalogueUsage;
  usageSnapshots: Map<string, CatalogueUsage>;
  highlightedKeys: string[];
}

/** Count one mount and settle it now or when the test resolves it. */
export function mountFrame(host: HookHost): Promise<MountedFrame> {
  host.mounts++;
  if (!host.deferredMount) return Promise.resolve(createMountedFrame(host));
  const pending = deferred<MountedFrame>();
  host.pendingMounts.push(pending);
  return pending.promise;
}

/** Mounted frame that records highlights, subscriptions and usage updates. */
export function createMountedFrame(host: HookHost): MountedFrame {
  let disposed = false;
  const mounted: MountedFrame = {
    dispose() {
      if (disposed) return;
      disposed = true;
      host.disposals++;
    },
    highlight: (keys) => {
      host.highlightedKeys = [...keys];
      return Promise.resolve();
    },
    listInstanceBoundaries: () => Promise.resolve([]),
    scrollTo: () => Promise.resolve(),
    subscribe: () => {
      host.activeSubscriptions++;
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        host.activeSubscriptions--;
      };
    },
  };
  if (host.supportsUsageUpdates)
    mounted.updateUsage = (usage) => {
      host.updateStatuses.push(usage.status);
      host.highlightedKeys = [];
      if (!host.deferredUpdates) return Promise.resolve();
      const pending = deferred<void>();
      host.pendingUpdates.push(pending);
      return pending.promise;
    };
  return mounted;
}

/** Ready usage for one entry-owned instance in a generated preview. */
export function previewUsage(): ComponentViewRecord {
  return {
    colorScheme: "light",
    instances: [
      {
        componentId: "component",
        id: "instance",
        key: "instance",
        order: 0,
        owner: { kind: "entry" },
        props: {},
        propsKey: "props",
      },
    ],
    ranges: [],
    slots: [],
    viewport: "desktop",
  };
}

/** Create a promise with its settle functions. */
export function deferred<T>(): Deferred<T> {
  let reject = (_error: unknown): void => undefined;
  let resolve = (_value: T): void => undefined;
  const promise = new Promise<T>((complete, fail) => {
    reject = fail;
    resolve = complete;
  });
  return { promise, reject, resolve };
}
