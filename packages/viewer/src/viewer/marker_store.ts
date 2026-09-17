import type { MarkerState } from "./types.js";

export interface MarkerRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface MarkerPlacement extends MarkerState {
  rect?: MarkerRect;
}

const EMPTY: readonly MarkerPlacement[] = [];

function samePlacement(
  left: readonly MarkerPlacement[],
  right: readonly MarkerPlacement[],
): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => {
      const next = right[index];
      return (
        next?.id === item.id &&
        next.status === item.status &&
        next.rect?.left === item.rect?.left &&
        next.rect?.top === item.rect?.top &&
        next.rect?.width === item.rect?.width &&
        next.rect?.height === item.rect?.height
      );
    })
  );
}

/** Runtime-owned immutable snapshots consumed by the React marker layer. */
export class MarkerStore {
  private listeners = new Set<() => void>();
  private snapshot: readonly MarkerPlacement[] = EMPTY;

  getSnapshot = (): readonly MarkerPlacement[] => this.snapshot;
  getServerSnapshot = (): readonly MarkerPlacement[] => EMPTY;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  set(next: readonly MarkerPlacement[]): void {
    if (samePlacement(this.snapshot, next)) return;
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }
}
