import type { InstanceBoundary } from "../client/frame_adapter.js";
import { frameUsage } from "../client/frame_usage.js";

import type { Session } from "./frame_session.js";
import { ObsoleteInspection } from "./inspection_work.js";

export type GeometryResult =
  | { kind: "ready"; boundaries: readonly InstanceBoundary[] }
  | { kind: "unavailable" }
  | { kind: "error"; error: unknown };

export interface GeometrySnapshot {
  pending: boolean;
  cycle: number;
  result?: GeometryResult;
}

interface Waiter {
  target: number;
  resolve(): void;
  reject(error: unknown): void;
}

interface GeometryEntry {
  session: Session;
  generation: number;
  requested: number;
  completed: number;
  cycle: number;
  dirty: boolean;
  running: boolean;
  pending: boolean;
  frame?: number;
  result?: GeometryResult;
  waiters: Waiter[];
}

/** One dirty-bit boundary reader per mounted frame session. */
export class GeometryRefresh {
  private entries = new Map<Session, GeometryEntry>();
  private listeners = new Set<(cycle: number) => void>();
  private demand: () => readonly Session[] = () => [];
  private resize: ResizeObserver;
  private expansion: MutationObserver;
  private cycle = 0;
  private disposed = false;
  private win: Window & typeof globalThis;

  constructor(private root: HTMLElement) {
    this.win = root.ownerDocument.defaultView! as Window & typeof globalThis;
    this.resize = new ResizeObserver(() => this.invalidate());
    this.expansion = new MutationObserver((records) => {
      if (
        records.some(
          ({ target }) =>
            target instanceof Element && target.matches(".browser-frame"),
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

  setDemand(demand: () => readonly Session[]): void {
    this.demand = demand;
  }

  snapshot(session: Session): GeometrySnapshot {
    const entry = this.entries.get(session);
    return entry
      ? {
          pending: entry.pending,
          cycle: entry.cycle,
          ...(entry.result ? { result: entry.result } : {}),
        }
      : { pending: false, cycle: this.cycle, result: { kind: "unavailable" } };
  }

  sync(sessions: readonly Session[]): void {
    const retained = new Map<Session, GeometryEntry>();
    for (const session of sessions) {
      const entry = this.entries.get(session) ?? this.create(session);
      retained.set(session, entry);
    }
    for (const [session, entry] of this.entries)
      if (!retained.has(session)) this.cancel(entry);
    this.entries = retained;
    this.resize.disconnect();
    this.resize.observe(this.root);
    for (const stage of this.root.querySelectorAll(
      "[data-workspace-preview], .mbk-flow, .mbk-stage-embed",
    ))
      this.resize.observe(stage);
    for (const { frame } of sessions) this.resize.observe(frame.element);
    this.updateExpanded();
  }

  refresh(sessions: readonly Session[] = this.demand()): Promise<void> {
    if (this.disposed) return Promise.reject(new ObsoleteInspection());
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

  supersede(sessions: readonly Session[]): void {
    for (const session of sessions) {
      const entry = this.entries.get(session);
      if (!entry) continue;
      this.cancel(entry);
      this.entries.set(session, this.create(session));
    }
  }

  private create(session: Session): GeometryEntry {
    return {
      session,
      generation: 0,
      requested: 0,
      completed: 0,
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
    let result: GeometryResult;
    try {
      let mounted;
      try {
        mounted = await entry.session.ready;
      } catch {
        mounted = undefined;
      }
      if (!this.current(entry, generation)) return;
      if (!mounted) result = { kind: "unavailable" };
      else if (entry.dirty) {
        entry.running = false;
        this.schedule(entry);
        return;
      } else {
        const usage = entry.session.frame.view?.usage;
        let inspectable = false;
        try {
          inspectable = usage?.status === "ready" && !frameUsage(usage).error;
        } catch {
          inspectable = false;
        }
        if (!inspectable) result = { kind: "unavailable" };
        else
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
    entry.completed = requested;
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
      if (this.disposed) return;
      for (const listener of this.listeners) listener(cycle);
    });
  }

  private invalidate = (): void => {
    if (!this.disposed) void this.refresh().catch(() => {});
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
    const error = new ObsoleteInspection();
    for (const waiter of entry.waiters) waiter.reject(error);
    entry.waiters = [];
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeEventListener("scroll", this.invalidate, true);
    this.win.removeEventListener("resize", this.invalidate);
    this.resize.disconnect();
    this.expansion.disconnect();
    this.root.classList.remove("frame-expanded");
    for (const entry of this.entries.values()) this.cancel(entry);
    this.entries.clear();
    this.listeners.clear();
  }
}
