/** Host marker placement over registry-owned frame sessions. */

import { visibleFrameBox } from "../client/component_geometry.js";
import { markerRect, markerStatus } from "../viewer/marker_geometry.js";
import type { CoordinateRect } from "../viewer/marker_geometry.js";
import type { MarkerPlacement, MarkerStore } from "../viewer/marker_store.js";
import type {
  InstanceRef,
  MarkerState,
  ViewerEvents,
  ViewerMarker,
} from "../viewer/types.js";

import type { ShellGeometrySnapshot } from "./frame_geometry.js";
import type { ShellFrameGeometryController } from "./frame_geometry_controller.js";
import {
  frameHasInstance,
  matchesFrameInstance,
  validFrameUsage,
} from "./frame_instances.js";
import type { ShellFrameSession } from "./frame_registry.js";

interface MarkerTarget {
  id: string;
  instance: InstanceRef;
}

/** Match host markers to authenticated shell-frame geometry. */
export class ShellFrameMarkers {
  private targets: readonly MarkerTarget[] = [];
  private lastStates: readonly MarkerState[] | undefined;
  private invalid = false;
  private initialized = false;
  private disposed = false;
  private reportedErrors = new Set<number>();

  constructor(
    private root: HTMLElement,
    private geometry: ShellFrameGeometryController,
    private sessions: () => readonly ShellFrameSession[],
    private store: MarkerStore,
    private events: () => ViewerEvents,
    private report: (error: unknown) => Error,
  ) {}

  update(markers: readonly ViewerMarker[]): void {
    if (this.disposed) return;
    const targets = markers.map(({ id, instance }) => ({
      id,
      instance: { ...instance },
    }));
    const invalid =
      new Set(targets.map(({ id }) => id)).size !== targets.length;
    if (
      this.initialized &&
      this.invalid === invalid &&
      sameTargets(this.targets, targets)
    )
      return;
    this.initialized = true;
    this.targets = targets;
    this.lastStates = undefined;
    if (invalid) {
      this.invalid = true;
      this.store.set([]);
      this.report(new Error("Marker ids must be unique."));
      return;
    }
    this.invalid = false;
    if (!targets.length) {
      this.publish([]);
      return;
    }
    void this.geometry.refresh().catch(() => undefined);
    this.evaluate();
  }

  changed(): void {
    this.evaluate();
  }

  demand = (): readonly ShellFrameSession[] => {
    if (this.invalid || !this.targets.length) return [];
    return this.sessions().filter((session) =>
      this.targets.some(
        ({ instance }) =>
          matchesFrameInstance(session, instance) &&
          frameHasInstance(session, instance.key),
      ),
    );
  };

  private evaluate(): void {
    if (!this.initialized || this.disposed || this.invalid) return;
    const mode = this.root
      .querySelector('[data-diff-mode][aria-pressed="true"]')
      ?.getAttribute("data-diff-mode");
    const current = mode === undefined || mode === "current";
    const layer = this.root.querySelector<HTMLElement>(
      "[data-mokly-marker-layer]",
    );
    const placements: MarkerPlacement[] = [];
    for (const target of this.targets) {
      const session = this.sessions().find((candidate) =>
        matchesFrameInstance(candidate, target.instance),
      );
      const usageReady = Boolean(session && validFrameUsage(session));
      const present = Boolean(
        session && usageReady && frameHasInstance(session, target.instance.key),
      );
      const snapshot = session
        ? this.geometry.snapshot(session)
        : ({ pending: false, cycle: 0 } satisfies ShellGeometrySnapshot);
      const boundary =
        snapshot.result?.kind === "ready"
          ? snapshot.result.boundaries.find(
              ({ key }) => key === target.instance.key,
            )
          : undefined;
      const measured = snapshot.result?.kind === "ready" && Boolean(boundary);
      const rect =
        session && layer && measured
          ? this.place(
              session,
              boundary?.ranges.flatMap(({ boxes }) => boxes) ?? [],
              layer,
            )
          : undefined;
      const status = markerStatus({
        current,
        matched: Boolean(session?.mounted && session.element.isConnected),
        usageReady,
        present,
        measurement: snapshot.pending
          ? "pending"
          : measured
            ? "ready"
            : "failed",
        visible: Boolean(rect),
      });
      if (status === "pending") return;
      if (snapshot.result?.kind === "error")
        this.reportMeasurement(snapshot.cycle, snapshot.result.error);
      else if (
        snapshot.result?.kind === "ready" &&
        usageReady &&
        present &&
        !boundary
      )
        this.reportMeasurement(
          snapshot.cycle,
          new Error("Marker boundary unavailable."),
        );
      placements.push({
        id: target.id,
        status,
        ...(rect && status === "visible" ? { rect } : {}),
      });
    }
    this.publish(placements);
  }

  private place(
    session: ShellFrameSession,
    boxes: Parameters<typeof markerRect>[0],
    layer: HTMLElement,
  ) {
    const frame = session.element;
    const visible = visibleFrameBox(frame);
    if (!visible || !frame.offsetWidth || !frame.offsetHeight) return;
    const stage = frame.closest<HTMLElement>(
      "[data-workspace-preview], .mbk-flow, .mbk-stage-embed",
    );
    const layerBounds = layer.getBoundingClientRect();
    const stageBounds = (
      frame.closest(".browser-frame.is-expanded")
        ? this.root
        : (stage ?? this.root)
    ).getBoundingClientRect();
    const clip = intersect(visible, stageBounds);
    const bounded = clip && intersect(clip, layerBounds);
    if (!bounded) return;
    const frameBounds = frame.getBoundingClientRect();
    return markerRect(boxes, {
      frameLeft: frameBounds.left,
      frameTop: frameBounds.top,
      frameClientLeft: frame.clientLeft,
      frameClientTop: frame.clientTop,
      scaleX: frameBounds.width / frame.offsetWidth,
      scaleY: frameBounds.height / frame.offsetHeight,
      clip: bounded,
      originLeft: layerBounds.left,
      originTop: layerBounds.top,
    });
  }

  private publish(placements: readonly MarkerPlacement[]): void {
    this.store.set(placements);
    const states = placements.map(({ id, status }) => ({ id, status }));
    if (sameStates(this.lastStates, states)) return;
    this.lastStates = states;
    this.events().onMarkerChange?.(states);
  }

  private reportMeasurement(cycle: number, error: unknown): void {
    if (this.reportedErrors.has(cycle)) return;
    this.reportedErrors.add(cycle);
    if (this.reportedErrors.size > 32)
      this.reportedErrors.delete(this.reportedErrors.values().next().value!);
    this.report(error);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.targets = [];
  }
}

function intersect(
  first: CoordinateRect,
  second: CoordinateRect,
): CoordinateRect | undefined {
  const result = {
    left: Math.max(first.left, second.left),
    top: Math.max(first.top, second.top),
    right: Math.min(first.right, second.right),
    bottom: Math.min(first.bottom, second.bottom),
  };
  return result.right > result.left && result.bottom > result.top
    ? result
    : undefined;
}

function sameStates(
  previous: readonly MarkerState[] | undefined,
  next: readonly MarkerState[],
): boolean {
  return Boolean(
    previous &&
    previous.length === next.length &&
    previous.every(
      (state, index) =>
        state.id === next[index]?.id && state.status === next[index]?.status,
    ),
  );
}

function sameTargets(
  previous: readonly MarkerTarget[],
  next: readonly MarkerTarget[],
): boolean {
  return (
    previous.length === next.length &&
    previous.every((target, index) => {
      const candidate = next[index];
      return (
        candidate?.id === target.id &&
        candidate.instance.screenId === target.instance.screenId &&
        candidate.instance.variantId === target.instance.variantId &&
        candidate.instance.stepIndex === target.instance.stepIndex &&
        candidate.instance.viewport === target.instance.viewport &&
        candidate.instance.colorScheme === target.instance.colorScheme &&
        candidate.instance.key === target.instance.key
      );
    })
  );
}
