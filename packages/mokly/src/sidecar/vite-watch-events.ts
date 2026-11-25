import type { Plugin, ViteDevServer } from "vite";

import { detail } from "./errors.js";

export type ViteWatchEvent = "create" | "update" | "delete";

const watcherEvents = {
  create: "add",
  update: "change",
  delete: "unlink",
} as const;

const listenerEvents = [...Object.values(watcherEvents), "all"] as const;

type Watcher = ViteDevServer["watcher"];
type WatcherEvent = (typeof listenerEvents)[number];
type Listener = ReturnType<Watcher["rawListeners"]>[number];

/** Deliver change events without calling Vite's own watcher handlers. */
export class ViteWatchEvents {
  private readonly listeners = new Map<WatcherEvent, Set<Listener>>();

  constructor(private readonly normalizePath: (file: string) => string) {}

  readonly capture = {
    order: "pre",
    handler: ({ watcher }) => {
      for (const event of listenerEvents)
        this.listeners.set(event, new Set(watcher.rawListeners(event)));
    },
  } satisfies NonNullable<Plugin["configureServer"]>;

  configured(watcher: Watcher): void {
    for (const event of listenerEvents) {
      const before = this.listeners.get(event);
      this.listeners.set(
        event,
        new Set(
          watcher
            .rawListeners(event)
            .filter((listener) => !before?.has(listener)),
        ),
      );
    }
  }

  async dispatch(
    server: ViteDevServer,
    changes: ReadonlyMap<string, ViteWatchEvent>,
  ): Promise<void> {
    const { watcher } = server;
    for (const [path, event] of changes) {
      const file = this.normalizePath(path);
      const watcherEvent = watcherEvents[event];
      const results = await Promise.allSettled([
        ...Object.values(server.environments).map((environment) =>
          environment.pluginContainer.watchChange(file, { event }),
        ),
        ...this.callListeners(watcher, watcherEvent, [file]),
        ...this.callListeners(watcher, "all", [watcherEvent, file]),
      ]);
      for (const result of results)
        if (result.status === "rejected")
          server.config.logger.error(detail(result.reason));
    }
  }

  private callListeners(
    watcher: Watcher,
    event: WatcherEvent,
    args: string[],
  ): Promise<unknown>[] {
    const listeners = this.listeners.get(event);
    return watcher
      .rawListeners(event)
      .filter((listener) => listeners?.has(listener))
      .map(async (listener) => listener.apply(watcher, args));
  }
}
