import type fs from "node:fs";
import path from "node:path";

import { minimatch } from "minimatch";

import { isBaselineCachePath } from "../config/cache_paths.js";
import { isAuthoredEntryPath } from "../config/entry_membership.js";
import { isInside, toPosixPath } from "../config/paths.js";
import type { ResolvedConfig, WatchAction } from "../config/types.js";

import {
  configuredStylesheetPaths,
  isEntryGlobCandidate,
  isPackageOwnedIgnoredWatchPath,
} from "./watch_paths.js";

/** Filesystem notification with the watcher-provided identity and directory evidence. */
export type WatchEvent = {
  readonly path: string;
  readonly kind: "add" | "addDir" | "change" | "unlink" | "unlinkDir" | "raw";
  readonly stats?: fs.Stats;
};

/** Directory evidence shared by traversal pruning and entry classification. */
export type WatchDirectoryStatus = "directory" | "file" | "unknown";

/** Internal watch work, including package-owned configuration reloads. */
export type RuntimeWatchAction = "reconfigure" | "evidence" | WatchAction;

/** Buffer notifications until startup is ready to process them. */
export class NotificationGate<Value> {
  readonly #buffer: Value[] = [];
  #consumer: ((value: Value) => void) | undefined;

  constructor(private readonly report: (error: unknown) => void) {}

  /** Queue or immediately deliver one notification. */
  notify(value: Value): void {
    if (this.#consumer) this.deliver(value);
    else this.#buffer.push(value);
  }

  /** Open the gate and flush startup notifications in arrival order. */
  open(consumer: (value: Value) => void): void {
    this.#consumer = consumer;
    for (const value of this.#buffer.splice(0)) this.deliver(value);
  }

  /** Deliver one value while preserving the isolation boundary. */
  private deliver(value: Value): void {
    try {
      this.#consumer?.(value);
    } catch (error) {
      this.report(error);
    }
  }
}

/** Minimal clock seam for deterministic debounce tests. */
export interface DebounceClock {
  clear(handle: ReturnType<typeof setTimeout>): void;
  schedule(
    callback: () => void,
    milliseconds: number,
  ): ReturnType<typeof setTimeout>;
}

/** Runtime clock backed by Node timers. */
export const systemDebounceClock: DebounceClock = {
  clear: clearTimeout,
  schedule: setTimeout,
};

const ACTION_PRIORITY: readonly RuntimeWatchAction[] = [
  "reconfigure",
  "rebuild",
  "restart",
  "reload",
  "evidence",
  "ignore",
];

/** Coalesce filesystem notifications into one highest-impact action. */
export class WatchDebouncer {
  readonly #actions = new Set<RuntimeWatchAction>();
  readonly #paths = new Set<string>();
  #handle: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly delay: number,
    private readonly callback: (
      action: RuntimeWatchAction,
      paths: readonly string[],
    ) => void,
    private readonly clock: DebounceClock = systemDebounceClock,
  ) {}

  /** Add one classified notification to the current burst. */
  notify(action: RuntimeWatchAction, candidate?: string): void {
    this.#actions.add(action);
    if (action !== "ignore" && candidate) this.#paths.add(candidate);
    if (this.#handle) this.clock.clear(this.#handle);
    this.#handle = this.clock.schedule(() => this.flush(), this.delay);
  }

  /** Cancel pending work. */
  close(): void {
    if (this.#handle) this.clock.clear(this.#handle);
    this.#handle = undefined;
    this.#actions.clear();
    this.#paths.clear();
  }

  private flush(): void {
    this.#handle = undefined;
    const action = ACTION_PRIORITY.find((candidate) =>
      this.#actions.has(candidate),
    );
    this.#actions.clear();
    const paths = [...this.#paths];
    this.#paths.clear();
    if (action && action !== "ignore") this.callback(action, paths);
  }
}

/** Serialize watch work and coalesce changes received during active work. */
export class WatchActionQueue {
  readonly #pending = new Set<RuntimeWatchAction>();
  readonly #paths = new Set<string>();
  #closed = false;
  #draining: Promise<void> | undefined;

  constructor(
    private readonly process: (
      action: RuntimeWatchAction,
      paths: readonly string[],
    ) => Promise<void>,
    private readonly reportError: (error: unknown) => void,
  ) {}

  /** Queue one action; a stronger pending action subsumes weaker actions. */
  notify(action: RuntimeWatchAction, paths: readonly string[] = []): void {
    if (this.#closed || action === "ignore") return;
    this.#pending.add(action);
    for (const candidate of paths) this.#paths.add(candidate);
    if (!this.#draining) this.#draining = this.drain();
  }

  /** Wait until all currently queued work has completed. */
  async settled(): Promise<void> {
    while (this.#draining) await this.#draining;
  }

  /** Discard pending work and wait for the active operation to finish. */
  async close(): Promise<void> {
    this.#closed = true;
    this.#pending.clear();
    this.#paths.clear();
    await this.#draining;
  }

  private async drain(): Promise<void> {
    try {
      while (!this.#closed && this.#pending.size > 0) {
        const action = ACTION_PRIORITY.find((candidate) =>
          this.#pending.has(candidate),
        );
        const paths = [...this.#paths];
        this.#pending.clear();
        this.#paths.clear();
        if (!action || action === "ignore") continue;
        try {
          await this.process(action, paths);
        } catch (error) {
          this.reportError(error);
        }
      }
    } finally {
      this.#draining = undefined;
      if (!this.#closed && this.#pending.size > 0) {
        this.#draining = this.drain();
      }
    }
  }
}

/** Classify one consumer path using configured inputs and reachable resources. */
export function classifyWatchPath(
  event: WatchEvent,
  config: ResolvedConfig,
  resources: ReadonlySet<string> = new Set(),
): RuntimeWatchAction {
  const absolute = path.resolve(event.path);
  const directory = directoryStatus(event);
  if (isBaselineCachePath(absolute, config.repoRoot)) return "ignore";
  if (
    absolute === config.configPath ||
    config.configSourceFiles?.some(
      (source) => path.resolve(config.repoRoot, source) === absolute,
    )
  )
    return "reconfigure";
  if (
    config.sourceFiles?.some(
      (source) => path.resolve(config.repoRoot, source) === absolute,
    )
  )
    return "rebuild";
  if (isAuthoredEntryPath(absolute, config)) return "rebuild";
  if (isEntryGlobCandidate(absolute, config, directory)) return "rebuild";
  if (config.renderer === absolute) return "rebuild";
  const relative = toPosixPath(path.relative(config.repoRoot, absolute));
  if (
    isPackageOwnedIgnoredWatchPath(
      absolute,
      config,
      event.stats,
      "event",
      directory,
    )
  )
    return "ignore";
  if ([...resources].some((resource) => isInside(absolute, resource)))
    return "reload";
  const stylesheetPaths = configuredStylesheetPaths(config);
  if (
    stylesheetPaths.some(
      (value) =>
        !/^https?:\/\//.test(value) &&
        path.resolve(config.mockupsDir, value) === absolute,
    )
  ) {
    return "reload";
  }
  for (const rule of config.watch.rules) {
    if (rule.paths.some((glob) => minimatch(relative, glob, { dot: true })))
      return rule.action;
  }
  return "ignore";
}

/** Prefer supplied stats, retaining deleted-directory identity through the event kind. */
function directoryStatus(event: WatchEvent): WatchDirectoryStatus {
  if (event.stats) return event.stats.isDirectory() ? "directory" : "file";
  if (event.kind === "addDir" || event.kind === "unlinkDir") return "directory";
  if (
    event.kind === "add" ||
    event.kind === "change" ||
    event.kind === "unlink"
  )
    return "file";
  return "unknown";
}
