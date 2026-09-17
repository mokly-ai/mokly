import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

import { BaselineError } from "../dist/baseline/errors.js";
import type { BaselineBuilder } from "../dist/baseline/types.js";
import { FileSystemGeneratedOutputStore } from "../dist/build/output_store.js";
import { FileSystemConfigLoader } from "../dist/config/load.js";
import type { ResolvedConfig } from "../dist/config/types.js";
import {
  NodeCatalogueServerFactory,
  type CatalogueServerFactory,
} from "../dist/server/factory.js";
import type {
  RunningServer,
  ServerOptions,
} from "../dist/server/http_types.js";
import { serve, type ServeDependencies } from "../dist/server/serve.js";
import { NodeProcessSupervisorFactory } from "../dist/server/supervisor.js";
import type { ChangesStatus } from "../dist/server/update_messages.js";
import { ChokidarWatcherFactory } from "../dist/server/watcher.js";

import {
  GatedBaselineBuilder,
  nodeBaselineBuilder,
} from "./helpers/baseline_builders.js";
import { derivedFixture } from "./helpers/derived_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";

/** Record every status the parent publishes, including the opening one. */
class RecordingServerFactory implements CatalogueServerFactory {
  readonly statuses: ChangesStatus[] = [];
  private readonly inner = new NodeCatalogueServerFactory();
  async start(
    config: ResolvedConfig,
    options: ServerOptions,
  ): Promise<RunningServer> {
    const server = await this.inner.start(config, options);
    if (options.changesStatus) this.statuses.push(options.changesStatus);
    return {
      ...server,
      publishUpdate: (update) => {
        if (update?.changesStatus) this.statuses.push(update.changesStatus);
        server.publishUpdate(update);
      },
    };
  }
}

function serveDependencies(
  serverFactory: CatalogueServerFactory,
  baselineBuilder: BaselineBuilder,
): ServeDependencies {
  return {
    baselineBuilder,
    configLoader: new FileSystemConfigLoader(),
    outputStore: new FileSystemGeneratedOutputStore(),
    processSupervisorFactory: new NodeProcessSupervisorFactory(),
    serverFactory,
    watcherFactory: new ChokidarWatcherFactory(),
  };
}

test(
  "derived Serve shows preparing, returns to pending, then publishes Changes",
  { timeout: 30000 },
  async (t) => {
    const fixture = await derivedFixture(t);
    const builder = new GatedBaselineBuilder();
    const servers = new RecordingServerFactory();
    const running = await serve(
      fixture.config,
      { port: 0, watch: false },
      serveDependencies(servers, builder),
    );
    try {
      const preparing = await waitForStatus(running.url, "preparing");
      assert.match(
        preparing,
        /<span class="mbk-nav-status-title">Preparing comparison<\/span>/,
      );
      assert.match(
        preparing,
        /<span class="mbk-nav-status-detail">This takes a moment\. You can keep browsing All while it finishes\.<\/span>/,
      );
      assert.match(
        preparing,
        /class="mbk-nav-spinner" role="status" aria-label="Preparing comparison"/,
      );
      assert.equal(
        (await fetch(`${running.url}/view/screens/home.html`)).status,
        200,
      );
      builder.releaseAll();
      await waitForStatus(running.url, "ready");
      assert.deepEqual(servers.statuses, [
        "pending",
        "preparing",
        "pending",
        "ready",
      ]);
      assert.deepEqual(
        builder.builds.map((build) => build.commit),
        [fixture.commit],
      );
    } finally {
      builder.releaseAll();
      await running.close();
    }
  },
);

test(
  "a cached derived baseline never leaves the pending Changes state",
  { timeout: 30000 },
  async (t) => {
    const fixture = await derivedFixture(t);
    const first = await serve(
      fixture.config,
      { port: 0, watch: false },
      serveDependencies(
        new NodeCatalogueServerFactory(),
        nodeBaselineBuilder(),
      ),
    );
    try {
      await waitForStatus(first.url, "ready");
    } finally {
      await first.close();
    }
    const servers = new RecordingServerFactory();
    const running = await serve(
      fixture.config,
      { port: 0, watch: false },
      serveDependencies(servers, nodeBaselineBuilder()),
    );
    try {
      await waitForStatus(running.url, "ready");
      assert.deepEqual(servers.statuses, ["pending", "ready"]);
    } finally {
      await running.close();
    }
  },
);

test(
  "a failed derived rebuild reports unavailable without naming its reason",
  { timeout: 30000 },
  async (t) => {
    const fixture = await derivedFixture(t);
    const reason = "Baseline command 0 (npm ci) failed with exit code 1";
    const builder = new GatedBaselineBuilder(
      undefined,
      new BaselineError("baseline-command-failed", reason),
    );
    builder.releaseAll();
    const servers = new RecordingServerFactory();
    const logged: string[] = [];
    t.mock.method(process.stderr, "write", (chunk: string) => {
      logged.push(String(chunk));
      return true;
    });
    const running = await serve(
      fixture.config,
      { port: 0, watch: false },
      serveDependencies(servers, builder),
    );
    try {
      const html = await waitForStatus(running.url, "unavailable");
      assert.match(
        html,
        /Changes are unavailable\. You can still browse All\./,
      );
      assert.doesNotMatch(html, /npm ci|baseline-command-failed|exit code/);
      assert.deepEqual(servers.statuses, [
        "pending",
        "preparing",
        "unavailable",
      ]);
      assert.ok(logged.some((line) => line.includes(reason)));
      assert.equal(
        (await fetch(`${running.url}/view/screens/home.html`)).status,
        200,
      );
    } finally {
      await running.close();
    }
  },
);

test(
  "a moved merge base cancels the running rebuild and prepares the new commit",
  { timeout: 40000 },
  async (t) => {
    const fixture = await derivedFixture(t);
    const builder = new GatedBaselineBuilder();
    const running = await serve(
      fixture.config,
      { port: 0, watch: true },
      serveDependencies(new NodeCatalogueServerFactory(), builder),
    );
    try {
      await waitForStatus(running.url, "preparing");
      assert.ok(builder.builds.length >= 1);
      for (const build of builder.builds)
        assert.equal(build.commit, fixture.commit);
      await fixture.git("commit", "-q", "--allow-empty", "-m", "test: advance");
      await fixture.git("update-ref", "refs/remotes/origin/main", "HEAD");
      const moved = (await fixture.git("rev-parse", "HEAD")).stdout.trim();
      assert.notEqual(moved, fixture.commit);
      const restarted = await waitFor(() =>
        builder.builds.find((build) => build.commit === moved),
      );
      for (const build of builder.builds)
        if (build.commit === fixture.commit)
          assert.equal(build.signal?.aborted, true);
      assert.equal(restarted.signal?.aborted, false);
      await waitForStatus(running.url, "preparing");
      builder.releaseAll();
      await waitForStatus(running.url, "ready");
    } finally {
      builder.releaseAll();
      await running.close();
    }
  },
);

async function waitForStatus(url: string, status: string): Promise<string> {
  return waitFor(async () => {
    const page = await (await fetch(url)).text();
    return page.includes(`data-changes-status="${status}"`) ? page : undefined;
  });
}

test(
  "watched content edits preserve preparing and reuse the running baseline",
  { timeout: 30000 },
  async (t) => {
    const fixture = await derivedFixture(t);
    const builder = new GatedBaselineBuilder();
    const running = await serve(
      fixture.config,
      { port: 0, watch: true },
      serveDependencies(new NodeCatalogueServerFactory(), builder),
    );
    try {
      await waitForStatus(running.url, "preparing");
      const original = builder.builds[0]!;
      await fs.writeFile(
        fixture.entryPath,
        validEntrySource({ body: "Freshly edited preview" }),
      );
      await waitFor(async () => {
        const document = await (
          await fetch(`${running.url}/static/screens/home.mobile.html`)
        ).text();
        return document.includes("Freshly edited preview")
          ? document
          : undefined;
      });
      assert.equal(original.signal?.aborted, false);
      assert.match(
        await (await fetch(running.url)).text(),
        /data-changes-status="preparing"/,
      );
      builder.releaseAll();
      await waitForStatus(running.url, "ready");
      assert.equal(builder.builds.length, 1);
    } finally {
      builder.releaseAll();
      await running.close();
    }
  },
);

async function waitFor<T>(read: () => Promise<T | undefined> | T | undefined) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const value = await read();
    if (value !== undefined) return value;
    await setTimeout(50);
  }
  throw new Error("Derived Serve did not reach the expected state");
}
