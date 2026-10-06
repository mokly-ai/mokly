/** Coalesce resource notifications, including entry replacements Chokidar omits. */

import path from "node:path";

import type { WatchEvent } from "./watch_events.js";
import type { WatchIgnorePredicate } from "./watcher.js";

/** Merge normalized file changes and raw rename events into one settled notification. */
export class ResourceWatchNotifications {
  readonly #pending = new Map<string, ReturnType<typeof setTimeout>>();
  #closed = false;

  constructor(private readonly changed: (event: WatchEvent) => void) {}

  notify(event: WatchEvent): void {
    const candidate = event.path;
    if (this.#closed) return;
    clearTimeout(this.#pending.get(candidate));
    this.#pending.set(
      candidate,
      setTimeout(() => {
        this.#pending.delete(candidate);
        this.changed(event);
      }, 75),
    );
  }

  close(): void {
    this.#closed = true;
    for (const timer of this.#pending.values()) clearTimeout(timer);
    this.#pending.clear();
  }
}

/** Resolve named directory entries without following aliases or reloading their parent. */
export function rawRenamePaths(
  rawPath: unknown,
  details: unknown,
  ignore?: WatchIgnorePredicate,
): string[] {
  if (typeof rawPath !== "string" || rawPath.length === 0) return [];
  if (!details || typeof details !== "object" || !("watchedPath" in details))
    return [];
  const watched = details.watchedPath;
  if (typeof watched !== "string") return [];
  return [
    ...new Set([
      path.resolve(watched, rawPath),
      path.resolve(path.dirname(watched), rawPath),
    ]),
  ].filter((candidate) => !ignore?.(candidate));
}
