/** Registry-scoped geometry shared by inspection labels and host markers. */

import { ShellFrameGeometry } from "./frame_geometry.js";
import type { ShellGeometrySnapshot } from "./frame_geometry.js";
import type {
  ShellFrameRegistry,
  ShellFrameSession,
} from "./frame_registry.js";

interface GeometryConsumer {
  demand(): readonly ShellFrameSession[];
  root: HTMLElement;
}

type GeometryListener = (cycle: number) => void;

interface GeometryScheduler {
  dispose(): void;
  refresh(sessions?: readonly ShellFrameSession[]): Promise<void>;
  setDemand(demand: () => readonly ShellFrameSession[]): void;
  snapshot(session: ShellFrameSession): ShellGeometrySnapshot;
  subscribe(listener: GeometryListener): () => void;
  supersede(sessions: readonly ShellFrameSession[]): void;
  sync(sessions: readonly ShellFrameSession[]): void;
}

type GeometryFactory = (root: HTMLElement) => GeometryScheduler;

/** Coordinate one coalescing geometry scheduler for every registry consumer. */
export class ShellFrameGeometryController {
  private readonly consumers = new Map<object, GeometryConsumer>();
  private readonly listeners = new Set<GeometryListener>();
  private geometry: GeometryScheduler | undefined;
  private root: HTMLElement | undefined;
  private unsubscribe: (() => void) | undefined;
  private revisions = new Map<ShellFrameSession, number>();

  constructor(
    private readonly registry: ShellFrameRegistry,
    private readonly create: GeometryFactory = (root) =>
      new ShellFrameGeometry(root),
  ) {}

  acquire(
    owner: object,
    root: HTMLElement,
    demand: () => readonly ShellFrameSession[],
  ): () => void {
    this.consumers.set(owner, { demand, root });
    this.reconcile();
    return () => {
      if (!this.consumers.delete(owner)) return;
      this.reconcile();
    };
  }

  subscribe(listener: GeometryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  snapshot(session: ShellFrameSession): ShellGeometrySnapshot {
    return (
      this.geometry?.snapshot(session) ?? {
        pending: false,
        cycle: 0,
        result: { kind: "unavailable" },
      }
    );
  }

  refresh(sessions?: readonly ShellFrameSession[]): Promise<void> {
    return this.geometry?.refresh(sessions) ?? Promise.resolve();
  }

  supersede(sessions: readonly ShellFrameSession[]): void {
    this.geometry?.supersede(sessions);
  }

  sync(): void {
    if (!this.geometry) return;
    const sessions = this.registry.values();
    const added = sessions.filter((session) => !this.revisions.has(session));
    const changed = sessions.filter((session) => {
      const previous = this.revisions.get(session);
      return previous !== undefined && previous !== session.usageRevision;
    });
    this.revisions = new Map(
      sessions.map((session) => [session, session.usageRevision]),
    );
    this.geometry.sync(sessions);
    if (changed.length) this.geometry.supersede(changed);
    if (added.length || changed.length)
      void this.geometry.refresh().catch(() => undefined);
  }

  private demand = (): readonly ShellFrameSession[] => {
    return [
      ...new Set(
        [...this.consumers.values()].flatMap((consumer) => consumer.demand()),
      ),
    ];
  };

  private reconcile(): void {
    const root = this.commonRoot();
    if (!root) {
      this.disposeGeometry();
      return;
    }
    if (this.geometry && this.root === root) {
      this.sync();
      return;
    }
    this.disposeGeometry();
    const geometry = this.create(root);
    this.geometry = geometry;
    this.root = root;
    geometry.setDemand(this.demand);
    this.unsubscribe = geometry.subscribe((cycle) => {
      for (const listener of this.listeners) listener(cycle);
    });
    this.sync();
  }

  private commonRoot(): HTMLElement | undefined {
    const roots = [...this.consumers.values()].map(({ root }) => root);
    if (!roots.length) return;
    const first = roots[0]!;
    return roots.every((candidate) => candidate === first) ? first : undefined;
  }

  private disposeGeometry(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.geometry?.dispose();
    this.geometry = undefined;
    this.root = undefined;
    this.revisions.clear();
  }
}
