/**
 * The selected instance's box on its frame and its box model. The reader
 * measures the box model through the frame adapter's `boxModel`, again after
 * each `geometry` event, and fences each result to the session revision that
 * asked for it. An instance without a box model, or a frame whose adapter
 * has none, takes the smallest rectangle that holds its boxes instead.
 */

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import type {
  Box,
  BoxSides,
  InstanceBoundary,
  InstanceBoxModel,
} from "@mokly/frame";

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
  /**
   * The instance's border box, or without a box model the smallest rectangle
   * that holds its boxes, in the frame's CSS pixels.
   */
  box: Box;
  /** The box model, when the frame measured one. */
  model?: InstanceBoxModel;
  /** The rounded sizes of the box model. */
  sizes?: InstanceBoxSizes;
}

/** The smallest rectangle that holds the boxes of one instance, if it has any. */
export function boundaryBox(
  boundaries: readonly InstanceBoundary[],
  key: string,
): Box | undefined {
  const boxes = boundaries
    .filter((boundary) => boundary.key === key)
    .flatMap((boundary) => boundary.ranges.flatMap((range) => range.boxes));
  if (!boxes.length) return undefined;
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
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
      !mounted
    )
      return;
    const capture = captureFrame(session);
    const request = this.request;
    const apply = (reading: InstanceBoxReading | undefined) => {
      if (
        request === this.request &&
        key === this.key &&
        session === this.session &&
        session.status === "ready" &&
        session.mounted === mounted &&
        currentFrameCapture(this.registry, capture)
      ) {
        this.capture = capture;
        this.publish(reading);
      }
    };
    this.inFlight = true;
    try {
      if (!frameHasInstance(session, key)) return;
      const model = mounted.boxModel ? await mounted.boxModel(key) : null;
      if (model) {
        apply({ box: model.box, model, sizes: instanceBoxSizes(model) });
        return;
      }
      const box = boundaryBox(await mounted.listInstanceBoundaries(), key);
      apply(box ? { box } : undefined);
    } catch {
      apply(undefined);
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
