import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import type { BoxSides, InstanceBoxModel } from "@mokly/frame";

import {
  captureFrame,
  currentFrameCapture,
  frameHasInstance,
  type ShellFrameCapture,
} from "./frame_instances.js";
import type {
  ShellFrameRegistry,
  ShellFrameSession,
} from "./frame_registry.js";

export interface InstanceBoxSizes {
  width: number;
  height: number;
  padding: BoxSides;
  contentWidth: number;
  contentHeight: number;
}

export interface InstanceBoxReading {
  model: InstanceBoxModel;
  sizes: InstanceBoxSizes;
}

/** Derive shown lengths from unrounded CSS pixels. */
export function instanceBoxSizes({
  box,
  border,
  padding,
}: InstanceBoxModel): InstanceBoxSizes {
  return {
    width: Math.round(box.width),
    height: Math.round(box.height),
    padding: {
      top: Math.round(padding.top),
      right: Math.round(padding.right),
      bottom: Math.round(padding.bottom),
      left: Math.round(padding.left),
    },
    contentWidth: Math.round(
      Math.max(
        0,
        box.width - border.left - border.right - padding.left - padding.right,
      ),
    ),
    contentHeight: Math.round(
      Math.max(
        0,
        box.height - border.top - border.bottom - padding.top - padding.bottom,
      ),
    ),
  };
}

/** Serialize selection measurements and fence results to their session revision. */
export class InstanceBoxModelReader {
  private session: ShellFrameSession | undefined;
  private key: string | undefined;
  private revision = -1;
  private status: ShellFrameSession["status"] | undefined;
  private mounted: ShellFrameSession["mounted"];
  private capture: ShellFrameCapture | undefined;
  private value: InstanceBoxReading | undefined;
  private readonly listeners = new Set<() => void>();
  private connected = false;
  private pending = false;
  private inFlight = false;
  private request = 0;

  constructor(private readonly registry: ShellFrameRegistry) {}

  snapshot = (): InstanceBoxReading | undefined => this.value;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  connect(): () => void {
    this.connected = true;
    const unsubscribe = this.registry.subscribe(() =>
      this.select(this.session, this.key),
    );
    const unsubscribeEvents = this.registry.subscribeEvents(
      (session, event) => {
        if (session === this.session && event.type === "geometry")
          this.refresh();
      },
    );
    this.refresh();
    return () => {
      unsubscribe();
      unsubscribeEvents();
      this.connected = false;
      this.pending = false;
      this.request += 1;
      this.publish(undefined);
    };
  }

  select(
    session: ShellFrameSession | undefined,
    key: string | undefined,
  ): void {
    if (
      session === this.session &&
      key === this.key &&
      (session?.usageRevision ?? -1) === this.revision &&
      session?.status === this.status &&
      session?.mounted === this.mounted
    )
      return;
    this.session = session;
    this.key = key;
    this.revision = session?.usageRevision ?? -1;
    this.status = session?.status;
    this.mounted = session?.mounted;
    this.request += 1;
    this.publish(undefined);
    this.refresh();
  }

  read(
    session: ShellFrameSession | undefined,
    key: string | undefined,
  ): InstanceBoxReading | undefined {
    return session === this.session &&
      key === this.key &&
      this.capture &&
      currentFrameCapture(this.registry, this.capture)
      ? this.value
      : undefined;
  }

  private publish(value: InstanceBoxReading | undefined): void {
    if (this.value === value) return;
    this.value = value;
    for (const listener of this.listeners) listener();
  }

  private refresh(): void {
    this.pending = true;
    void this.measure();
  }

  private async measure(): Promise<void> {
    if (!this.connected || this.inFlight || !this.pending) return;
    this.pending = false;
    const { session, key } = this;
    const mounted = session?.mounted;
    if (
      !session ||
      !key ||
      session.status !== "ready" ||
      session.controller.signal.aborted ||
      !this.registry.values().includes(session) ||
      !mounted?.boxModel
    )
      return;
    const capture = captureFrame(session);
    const request = this.request;
    const apply = (model: InstanceBoxModel | null) => {
      if (
        request === this.request &&
        key === this.key &&
        session === this.session &&
        session.status === "ready" &&
        session.mounted === mounted &&
        currentFrameCapture(this.registry, capture)
      ) {
        this.capture = capture;
        this.publish(
          model ? { model, sizes: instanceBoxSizes(model) } : undefined,
        );
      }
    };
    this.inFlight = true;
    try {
      if (!frameHasInstance(session, key)) return;
      apply(await mounted.boxModel(key));
    } catch {
      apply(null);
    } finally {
      this.inFlight = false;
      if (this.pending) void this.measure();
    }
  }
}

export function useInstanceBoxModel(
  registry: ShellFrameRegistry | undefined,
  session: ShellFrameSession | undefined,
  key: string | undefined,
): InstanceBoxReading | undefined {
  const reader = useMemo(
    () => (registry ? new InstanceBoxModelReader(registry) : undefined),
    [registry],
  );
  const subscribe = useCallback(
    (listener: () => void) => reader?.subscribe(listener) ?? (() => {}),
    [reader],
  );
  const snapshot = useCallback(() => reader?.snapshot(), [reader]);
  useSyncExternalStore(subscribe, snapshot, () => undefined);
  useEffect(() => reader?.connect(), [reader]);
  useEffect(() => reader?.select(session, key), [key, reader, session]);
  return reader?.read(session, key);
}
