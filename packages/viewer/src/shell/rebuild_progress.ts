/** Delayed watched-update progress, kept apart from React and browser timers. */

import { useEffect, useRef, useState } from "react";

import { REBUILD_PROGRESS_DELAY_MS } from "./rebuild_status_view.js";

/** Timer boundary: the shell passes the window's timers, tests a fake clock. */
export interface ProgressTimers {
  clearTimeout(handle: number): void;
  setTimeout(callback: () => void, delayMs: number): number;
}

/**
 * Follow one client's observations of `updating` and reveal progress only once
 * a single uninterrupted `true` interval reaches the delay. Repeated `true`
 * observations never restart the timer, and `false` cancels or hides it, so an
 * update that finishes in time never shows progress at all.
 */
export class DelayedProgress {
  #pending: number | undefined;
  #updating = false;
  #visible = false;

  constructor(
    private readonly timers: ProgressTimers,
    private readonly onVisibleChange: (visible: boolean) => void,
    private readonly delayMs = REBUILD_PROGRESS_DELAY_MS,
  ) {}

  /** Record the latest adopted `updating` value. */
  observe(updating: boolean): void {
    if (updating === this.#updating) return;
    this.#updating = updating;
    if (updating) {
      this.#pending = this.timers.setTimeout(() => {
        this.#pending = undefined;
        this.#reveal(true);
      }, this.delayMs);
      return;
    }
    this.#cancel();
    this.#reveal(false);
  }

  /** Stop a pending timer when the owning shell unmounts. */
  dispose(): void {
    this.#cancel();
  }

  #cancel(): void {
    if (this.#pending === undefined) return;
    this.timers.clearTimeout(this.#pending);
    this.#pending = undefined;
  }

  #reveal(visible: boolean): void {
    if (visible === this.#visible) return;
    this.#visible = visible;
    this.onVisibleChange(visible);
  }
}

/**
 * Whether delayed progress is visible for `updating`. Server rendering and
 * hydration start hidden; hydration begins the same delay as a later update.
 */
export function useDelayedProgress(updating: boolean): boolean {
  const [visible, setVisible] = useState(false);
  const progress = useRef<DelayedProgress | undefined>(undefined);
  useEffect(() => {
    const controller = new DelayedProgress(
      {
        clearTimeout: (handle) => window.clearTimeout(handle),
        setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
      },
      setVisible,
    );
    progress.current = controller;
    return () => {
      controller.dispose();
      progress.current = undefined;
    };
  }, []);
  useEffect(() => progress.current?.observe(updating), [updating]);
  return updating && visible;
}
