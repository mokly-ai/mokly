import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import { compileCatalogue } from "../../dist/build/compile.js";
import { loadConfig } from "../../dist/config/load.js";
import type { WatchEvent } from "../../dist/server/watch_events.js";
import type {
  ConsumerWatcher,
  ConsumerWatcherFactory,
  ConsumerWatchOptions,
  WatchIgnorePredicate,
} from "../../dist/server/watcher.js";

import { createFixture, removeFixture } from "./fixture.js";

/** Resource graph whose imported stylesheet can swap between existing leaves. */
export async function resourceFixture(context: TestContext) {
  const fixture = await createFixture(undefined, {
    extraConfig:
      'stylesheets: [{ match: "screens/home.html", stylesheets: ["home.css"] }],',
  });
  context.after(() => removeFixture(fixture));
  for (const [file, content] of [
    ["home.css", '@import "nested.css";'],
    ["nested.css", 'main { background: url("a.svg"); }'],
    ["a.svg", "<svg/>"],
    ["b.svg", '<svg width="42"/>'],
  ] as const)
    await fs.writeFile(path.join(fixture.mockupsDir, file), content);
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  return { ...fixture, config, compilation };
}

/** Watcher factory with controllable readiness and notifications. */
export class ResourceWatcherFactory implements ConsumerWatcherFactory {
  readonly watchers: ResourceTestWatcher[] = [];
  onReady: (watcher: ResourceTestWatcher) => Promise<void> = async () =>
    undefined;

  create(
    targets: readonly string[],
    ignore?: WatchIgnorePredicate,
    options?: ConsumerWatchOptions,
  ): ConsumerWatcher {
    const watcher = new ResourceTestWatcher(
      targets,
      ignore,
      options,
      (watcher) => this.onReady(watcher),
    );
    this.watchers.push(watcher);
    return watcher;
  }
}

/** Observe cleanup and emit queued events without real operating-system watches. */
export class ResourceTestWatcher implements ConsumerWatcher {
  closeCount = 0;
  private changed: ((event: WatchEvent) => void) | undefined;

  constructor(
    readonly targets: readonly string[],
    readonly ignore: WatchIgnorePredicate | undefined,
    readonly options: ConsumerWatchOptions | undefined,
    private readonly onReady: (watcher: ResourceTestWatcher) => Promise<void>,
  ) {}

  async close(): Promise<void> {
    this.closeCount += 1;
  }
  onChange(callback: (event: WatchEvent) => void): void {
    this.changed = callback;
  }
  onError(_callback: (error: Error) => void): void {}
  async ready(): Promise<void> {
    await this.onReady(this);
  }
  change(candidate: string): void {
    this.changed?.({ path: candidate, kind: "change" });
  }
}
