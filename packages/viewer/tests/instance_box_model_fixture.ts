import type { TestContext } from "node:test";

import type {
  InstanceBoundary,
  InstanceBoxModel,
  MountedFrame,
} from "@mokly/frame";

import {
  ShellFrameRegistry,
  type ShellFrameSession,
} from "../src/shell/frame_registry.js";
import { InstanceBoxModelReader } from "../src/shell/instance_box_model.js";

export const firstKey = "a".repeat(64);
export const secondKey = "b".repeat(64);
export const model: InstanceBoxModel = {
  box: { x: 10, y: 20, width: 160.4, height: 40.6 },
  border: { top: 2, right: 2, bottom: 2, left: 2 },
  padding: { top: 6.1, right: 12.2, bottom: 8.3, left: 14.4 },
};

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((complete, fail) => {
    resolve = complete;
    reject = fail;
  });
  return { promise, resolve, reject };
}

export function boxModelReaderFixture(
  t: TestContext,
  supported = true,
  boundaries: readonly InstanceBoundary[] = [],
) {
  const requests: {
    key: string;
    result: ReturnType<typeof deferred<InstanceBoxModel | null>>;
  }[] = [];
  const mounted: MountedFrame = {
    dispose() {},
    async highlight() {},
    async listInstanceBoundaries() {
      return boundaries;
    },
    async scrollTo() {},
    subscribe: () => () => {},
    ...(supported
      ? {
          boxModel(key: string) {
            const result = deferred<InstanceBoxModel | null>();
            requests.push({ key, result });
            return result.promise;
          },
        }
      : {}),
  };
  const registry = new ShellFrameRegistry({ mount: async () => mounted });
  const session = (): ShellFrameSession => ({
    controller: new AbortController(),
    element: {} as HTMLIFrameElement,
    generation: registry.nextGeneration(),
    identity: {
      entryPath: "screen",
      viewport: "desktop",
      colorScheme: "light",
    },
    mounted,
    ready: Promise.resolve(mounted),
    source: "/screen.html",
    status: "ready",
    usage: {
      status: "ready",
      instances: [firstKey, secondKey].map((key, order) => ({
        key,
        componentId: "action",
        id: `action-${order}`,
        order,
        owner: { kind: "entry" },
        props: {},
        propsKey: "c".repeat(64),
      })),
      ranges: [firstKey, secondKey].map((instanceKey, index) => ({
        id: `r-${index}`,
        target: { kind: "instance", instanceKey },
      })),
      slots: [],
    },
    usageRevision: 0,
  });
  const selected = session();
  registry.add(selected);
  const reader = new InstanceBoxModelReader(registry);
  t.after(reader.connect());
  return { reader, registry, session, selected, requests, mounted };
}
