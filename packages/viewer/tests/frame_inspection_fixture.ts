/** Registry sessions with recorded presentations for inspection controller tests. */

import { setImmediate } from "node:timers/promises";

import type { FrameAdapter, MountedFrame } from "@mokly/frame";
import type { CatalogueUsage } from "@mokly/model";

import type { InstanceRef } from "../src/host/types.js";
import type {
  ShellFrameRegistry,
  ShellFrameSession,
} from "../src/shell/frame_registry.js";

interface Deferred<T> {
  promise: Promise<T>;
  reject(error: unknown): void;
  resolve(value: T): void;
}

interface Presentation {
  keys: readonly string[];
  mode: "off" | "highlight" | "pick";
}

export const adapter: FrameAdapter = {
  async mount() {
    throw new Error("The controller fixture never mounts through an adapter.");
  },
};

export function sessionFixture(
  registry: ShellFrameRegistry,
  id: string,
  presentations: Presentation[] = [],
  ready?: Promise<MountedFrame>,
  highlight: MountedFrame["highlight"] = async (keys, mode) => {
    presentations.push({ keys: [...keys], mode });
  },
): ShellFrameSession & { presentations: Presentation[] } {
  const mounted: MountedFrame = {
    dispose() {},
    highlight,
    async listInstanceBoundaries() {
      return [];
    },
    async scrollTo() {},
    subscribe: () => () => {},
  };
  const session: ShellFrameSession & { presentations: Presentation[] } = {
    controller: new AbortController(),
    element: {} as HTMLIFrameElement,
    generation: registry.nextGeneration(),
    identity: {
      colorScheme: "light",
      entryPath: id,
      viewport: "desktop",
    },
    mounted,
    presentations,
    ready: ready ?? Promise.resolve(mounted),
    source: `/${id}.html`,
    status: "ready",
    usage: usage(instanceKey(id)),
    usageRevision: 0,
  };
  registry.add(session);
  return session;
}

function usage(key: string): CatalogueUsage {
  return {
    status: "ready",
    instances: [
      {
        componentId: "component",
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

export function reference(session: ShellFrameSession): InstanceRef {
  return {
    colorScheme: "light",
    key: instanceKey(session.identity.entryPath),
    screenPath: session.identity.entryPath,
    viewport: "desktop",
  };
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

export function instanceKey(id: string): string {
  const value = [...id].reduce((sum, character) => {
    return sum + character.charCodeAt(0);
  }, 0);
  return (value % 16).toString(16).repeat(64);
}

export async function settled<T>(promise: Promise<T>): Promise<T | "pending"> {
  return Promise.race([promise, setImmediate().then(() => "pending" as const)]);
}
