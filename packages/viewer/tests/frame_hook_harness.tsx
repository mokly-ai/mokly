/** Browser harness for React frame lifecycle regression tests. */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";

import type { CatalogueUsage } from "../src/catalogue/types.js";
import type {
  FrameAdapter,
  MountedFrame,
} from "../src/client/frame_adapter.js";
import type { ComponentViewRecord } from "../src/components/manifest_types.js";
import { useMountedShellFrame } from "../src/shell/frame_mount_hook.js";
import {
  ShellFrameRegistryProvider,
  useOptionalShellFrameRegistry,
  type ShellFrameRegistry,
} from "../src/shell/frame_registry.js";
import { generatedUsage } from "../src/shell/stage_sources.js";

interface Deferred<T> {
  promise: Promise<T>;
  reject(error: unknown): void;
  resolve(value: T): void;
}

interface HookHost {
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

const hosts = new Map<string, HookHost>();

interface FrameHookSnapshot {
  activeSubscriptions: number;
  disposals: number;
  mounts: number;
  pendingMounts: number;
  pendingUpdates: number;
  sessions: number;
  status: string;
  highlightedKeys: string[];
  updateStatuses: string[];
  usageRevision: number;
  usageStatus: string | undefined;
}

interface FrameHookHarness {
  highlight(id: string): Promise<void>;
  ready(id: string): Promise<string>;
  rejectMount(id: string): void;
  rejectUpdate(id: string): void;
  replaceDocument(id: string, kind: "identity" | "source"): void;
  remove(id: string): void;
  renderUsage(
    id: string,
    status: "pending" | "unavailable",
    snapshot?: string,
  ): void;
  rerender(id: string): void;
  resolveMount(id: string): void;
  resolveUpdate(id: string): void;
  snapshot(id: string): FrameHookSnapshot;
  start(
    id: string,
    options?: {
      deferredMount?: boolean;
      deferredUpdates?: boolean;
      generatedUsage?: boolean;
      strict?: boolean;
      supportsUsageUpdates?: boolean;
    },
  ): void;
}

/** Install the frame-only harness alongside the public viewer harness. */
export function installFrameHookHarness(): void {
  const browser = window as typeof window & {
    frameHookHarness: FrameHookHarness;
  };
  browser.frameHookHarness = {
    highlight: async (id) => {
      const mounted = requiredHost(id).registry?.values()[0]?.mounted;
      await mounted?.highlight(["instance"], "highlight");
    },
    ready: (id) => {
      const session = requiredHost(id).registry?.values()[0];
      if (!session) return Promise.resolve("missing");
      return session.ready.then(
        () => "ready",
        (error: unknown) =>
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "rejected",
      );
    },
    rejectMount: (id) =>
      requiredHost(id).pendingMounts.shift()?.reject(new Error("mount failed")),
    rejectUpdate: (id) =>
      requiredHost(id).pendingUpdates.shift()?.reject(new Error("obsolete")),
    replaceDocument: (id, kind) => {
      const host = requiredHost(id);
      host.documentIdentity++;
      if (kind === "source")
        host.source = `/static/screens/frame-hook-${host.documentIdentity}.html`;
      renderHost(host);
    },
    remove: (id) => {
      const host = requiredHost(id);
      host.root.unmount();
      host.element.remove();
    },
    renderUsage: (id, status, snapshot) => {
      const host = requiredHost(id);
      const retained = snapshot ? host.usageSnapshots.get(snapshot) : undefined;
      host.usage = retained ?? { status };
      if (snapshot && !retained) host.usageSnapshots.set(snapshot, host.usage);
      renderHost(host);
    },
    rerender: (id) => renderHost(requiredHost(id)),
    resolveMount: (id) => {
      const host = requiredHost(id);
      const pending = host.pendingMounts.shift();
      if (!pending) return;
      pending.resolve(createMountedFrame(host));
    },
    resolveUpdate: (id) => requiredHost(id).pendingUpdates.shift()?.resolve(),
    snapshot: (id) => {
      const host = requiredHost(id);
      const session = host.registry?.values()[0];
      return {
        activeSubscriptions: host.activeSubscriptions,
        disposals: host.disposals,
        mounts: host.mounts,
        pendingMounts: host.pendingMounts.length,
        pendingUpdates: host.pendingUpdates.length,
        sessions: host.registry?.values().length ?? 0,
        status: host.status,
        highlightedKeys: [...host.highlightedKeys],
        updateStatuses: [...host.updateStatuses],
        usageRevision: session?.usageRevision ?? 0,
        usageStatus: session?.usage.status,
      };
    },
    start: (id, options = {}) => {
      const element = document.createElement("section");
      element.id = id;
      document.body.append(element);
      const host: HookHost = {
        activeSubscriptions: 0,
        adapter: { mount: () => mountFrame(host) },
        deferredMount: options.deferredMount ?? false,
        deferredUpdates: options.deferredUpdates ?? false,
        disposals: 0,
        documentIdentity: 0,
        element,
        mounts: 0,
        ...(options.generatedUsage ? { previewUsage: previewUsage() } : {}),
        pendingMounts: [],
        pendingUpdates: [],
        registry: undefined,
        root: createRoot(element),
        source: "/static/screens/frame-hook.html",
        status: "unavailable",
        strict: options.strict ?? false,
        supportsUsageUpdates: options.supportsUsageUpdates ?? true,
        updateStatuses: [],
        usage: { status: "unavailable" },
        usageSnapshots: new Map(),
        highlightedKeys: [],
      };
      hosts.set(id, host);
      renderHost(host);
    },
  };
}

function renderHost(host: HookHost): void {
  const frame = (
    <ShellFrameRegistryProvider adapter={host.adapter}>
      <RegistryCapture host={host} />
      <HookFrame
        host={host}
        key={host.documentIdentity}
        usage={
          host.previewUsage
            ? generatedUsage({
                colorScheme: "light",
                path: "/__mokly/components/renders/preview.html",
                usage: host.previewUsage,
                viewport: "desktop",
              })
            : host.usage
        }
      />
    </ShellFrameRegistryProvider>
  );
  host.root.render(host.strict ? <StrictMode>{frame}</StrictMode> : frame);
}

function RegistryCapture({ host }: { host: HookHost }) {
  host.registry = useOptionalShellFrameRegistry();
  return null;
}

function HookFrame({ host, usage }: { host: HookHost; usage: CatalogueUsage }) {
  const mounted = useMountedShellFrame({
    enabled: true,
    identity: {
      entryId: `frame-hook-${host.documentIdentity}`,
      route: `screens/frame-hook-${host.documentIdentity}.html`,
    },
    onEvent: () => undefined,
    source: host.source,
    usage,
  });
  host.status = mounted.status;
  return (
    <iframe
      data-frame-hook-status={mounted.status}
      ref={mounted.frameRef}
      src="about:blank"
      title="Frame hook"
    />
  );
}

function mountFrame(host: HookHost): Promise<MountedFrame> {
  host.mounts++;
  if (!host.deferredMount) return Promise.resolve(createMountedFrame(host));
  const pending = deferred<MountedFrame>();
  host.pendingMounts.push(pending);
  return pending.promise;
}

function createMountedFrame(host: HookHost): MountedFrame {
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

function previewUsage(): ComponentViewRecord {
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
    resources: [],
    slots: [],
    styles: [],
    viewport: "desktop",
  };
}

function deferred<T>(): Deferred<T> {
  let reject = (_error: unknown): void => undefined;
  let resolve = (_value: T): void => undefined;
  const promise = new Promise<T>((complete, fail) => {
    reject = fail;
    resolve = complete;
  });
  return { promise, reject, resolve };
}

function requiredHost(id: string): HookHost {
  const host = hosts.get(id);
  if (!host) throw new Error(`Unknown frame hook host: ${id}`);
  return host;
}
