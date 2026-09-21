/** Coalesced authenticated geometry for React-owned frame sessions. */

import type { InstanceBoundary } from "../client/frame_adapter.js";

import { validFrameUsage } from "./frame_instances.js";
import type { ShellFrameSession } from "./frame_registry.js";

export type ShellGeometryResult =
  | { kind: "ready"; boundaries: readonly InstanceBoundary[] }
  | { kind: "unavailable" }
  | { kind: "error"; error: unknown };

export interface ShellGeometrySnapshot {
  pending: boolean;
  cycle: number;
  result?: ShellGeometryResult;
}

/** Expected cancellation when newer evidence replaces an in-flight read. */
export class SupersededFrameGeometry extends Error {}

interface Waiter {
  target: number;
  resolve(): void;
  reject(error: unknown): void;
}

interface GeometryEntry {
  session: ShellFrameSession;
  generation: number;
  requested: number;
  cycle: number;
  dirty: boolean;
  running: boolean;
  pending: boolean;
  frame?: number;
  result?: ShellGeometryResult;
  waiters: Waiter[];
}

/** One dirty-bit boundary reader per mounted registry session. */
export class ShellFrameGeometry {
  private entries = new Map<ShellFrameSession, GeometryEntry>();
  private readonly listeners = new Set<(cycle: number) => void>();
  private demand: () => readonly ShellFrameSession[] = () => [];
  private readonly resize: ResizeObserver;
  private resizeTargets = new Set<Element>();
  private readonly expansion: MutationObserver;
  private cycle = 0;
  private disposed = false;
  private readonly win: Window & typeof globalThis;

  constructor(private readonly root: HTMLElement) {
    this.win = root.ownerDocument.defaultView! as Window & typeof globalThis;
    this.resize = new this.win.ResizeObserver(() => this.invalidate());
    this.expansion = new this.win.MutationObserver((records) => {
      if (
        records.some(
          ({ target }) =>
            target instanceof this.win.Element &&
            target.matches(".browser-frame"),
        )
      ) {
        this.updateExpanded();
        this.invalidate();
      }
    });
    root.addEventListener("scroll", this.invalidate, {
      capture: true,
      passive: true,
    });
    this.win.addEventListener("resize", this.invalidate);
    this.expansion.observe(root, {
      attributes: true,
      attributeFilter: ["class"],
      subtree: true,
    });
  }

  subscribe(listener: (cycle: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setDemand(demand: () => readonly ShellFrameSession[]): void {
    this.demand = demand;
  }

  snapshot(session: ShellFrameSession): ShellGeometrySnapshot {
    const entry = this.entries.get(session);
    return entry
      ? {
          pending: entry.pending,
          cycle: entry.cycle,
          ...(entry.result ? { result: entry.result } : {}),
        }
      : { pending: false, cycle: this.cycle, result: { kind: "unavailable" } };
  }

  sync(sessions: readonly ShellFrameSession[]): void {
    const retained = new Map<ShellFrameSession, GeometryEntry>();
    for (const session of sessions)
      retained.set(session, this.entries.get(session) ?? this.create(session));
    for (const [session, entry] of this.entries)
      if (!retained.has(session)) this.cancel(entry);
    this.entries = retained;
    this.syncResizeTargets(sessions);
    this.updateExpanded();
  }

  private syncResizeTargets(sessions: readonly ShellFrameSession[]): void {
    const targets = new Set<Element>([this.root]);
    for (const stage of this.root.querySelectorAll(
      "[data-workspace-preview], .mbk-flow, .mbk-stage-embed",
    ))
      targets.add(stage);
    for (const session of sessions) targets.add(session.element);
    if (
      targets.size === this.resizeTargets.size &&
      [...targets].every((target) => this.resizeTargets.has(target))
    )
      return;
    this.resize.disconnect();
    for (const target of targets) this.resize.observe(target);
    this.resizeTargets = targets;
  }

  refresh(
    sessions: readonly ShellFrameSession[] = this.demand(),
  ): Promise<void> {
    if (this.disposed) return Promise.reject(new Error("Geometry disposed."));
    const cycle = ++this.cycle;
    const demanded = new Set(this.demand());
    const work = [...new Set(sessions)].flatMap((session) => {
      if (!demanded.has(session)) return [];
      const entry = this.entries.get(session);
      return entry ? [this.request(entry, cycle)] : [];
    });
    if (!work.length) this.announce(cycle);
    return Promise.all(work).then(() => undefined);
  }

  supersede(sessions: readonly ShellFrameSession[]): void {
    for (const session of sessions) {
      const entry = this.entries.get(session);
      if (!entry) continue;
      this.cancel(entry);
      this.entries.set(session, this.create(session));
    }
  }

  private create(session: ShellFrameSession): GeometryEntry {
    return {
      session,
      generation: 0,
      requested: 0,
      cycle: this.cycle,
      dirty: false,
      running: false,
      pending: false,
      waiters: [],
    };
  }

  private request(entry: GeometryEntry, cycle: number): Promise<void> {
    const target = ++entry.requested;
    entry.cycle = cycle;
    entry.dirty = true;
    entry.pending = true;
    this.schedule(entry);
    return new Promise<void>((resolve, reject) => {
      entry.waiters.push({ target, resolve, reject });
    });
  }

  private schedule(entry: GeometryEntry): void {
    if (entry.frame !== undefined || entry.running || this.disposed) return;
    entry.frame = this.win.requestAnimationFrame(() => {
      delete entry.frame;
      void this.run(entry);
    });
  }

  private async run(entry: GeometryEntry): Promise<void> {
    if (this.disposed || this.entries.get(entry.session) !== entry) return;
    entry.running = true;
    entry.dirty = false;
    const generation = entry.generation;
    const requested = entry.requested;
    const cycle = entry.cycle;
    let result: ShellGeometryResult;
    try {
      let mounted;
      try {
        mounted = await entry.session.ready;
      } catch {
        mounted = undefined;
      }
      if (!this.current(entry, generation)) return;
      if (
        !mounted ||
        !validFrameUsage(entry.session) ||
        !this.demand().includes(entry.session)
      )
        result = { kind: "unavailable" };
      else if (entry.dirty) {
        entry.running = false;
        this.schedule(entry);
        return;
      } else {
        result = {
          kind: "ready",
          boundaries: await mounted.listInstanceBoundaries(),
        };
      }
    } catch (error) {
      result = { kind: "error", error };
    } finally {
      entry.running = false;
    }
    if (!this.current(entry, generation)) return;
    if (entry.dirty) {
      this.schedule(entry);
      return;
    }
    entry.pending = false;
    entry.result = result;
    const waiters = entry.waiters;
    entry.waiters = [];
    for (const waiter of waiters) {
      if (waiter.target > requested) {
        entry.waiters.push(waiter);
        continue;
      }
      if (result.kind === "error") waiter.reject(result.error);
      else waiter.resolve();
    }
    this.announce(cycle);
  }

  private current(entry: GeometryEntry, generation: number): boolean {
    return (
      !this.disposed &&
      entry.generation === generation &&
      this.entries.get(entry.session) === entry
    );
  }

  private announce(cycle: number): void {
    queueMicrotask(() => {
      if (!this.disposed)
        for (const listener of this.listeners) listener(cycle);
    });
  }

  private invalidate = (): void => {
    if (!this.disposed) void this.refresh().catch(() => undefined);
  };

  private updateExpanded(): void {
    this.root.classList.toggle(
      "frame-expanded",
      Boolean(this.root.querySelector(".browser-frame.is-expanded")),
    );
  }

  private cancel(entry: GeometryEntry): void {
    entry.generation += 1;
    if (entry.frame !== undefined) this.win.cancelAnimationFrame(entry.frame);
    const error = new SupersededFrameGeometry("Geometry superseded.");
    for (const waiter of entry.waiters) waiter.reject(error);
    entry.waiters = [];
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeEventListener("scroll", this.invalidate, true);
    this.win.removeEventListener("resize", this.invalidate);
    this.resize.disconnect();
    this.resizeTargets.clear();
    this.expansion.disconnect();
    this.root.classList.remove("frame-expanded");
    for (const entry of this.entries.values()) this.cancel(entry);
    this.entries.clear();
    this.listeners.clear();
  }
}
