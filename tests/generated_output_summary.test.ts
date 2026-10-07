import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { RichReporter } from "../dist/cli/reporter/rich.js";
import { loadConfig } from "../dist/config/load.js";
import { serve } from "../dist/server/serve.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import { ResourceWatcherFactory } from "./helpers/resource_watcher.js";
import { memoryTerminal } from "./helpers/terminal.js";
import {
  FakeSupervisor,
  FakeSupervisorFactory,
} from "./helpers/watch_config.js";
import { waitFor } from "./server_fixture.js";

for (const watch of [false, true]) {
  for (const root of [false, true]) {
    test(`Serve writer summaries use the invocation directory and dot fallback (watch=${watch}, root=${root})`, async (t) => {
      const fixture = await createFixture();
      t.after(() => removeFixture(fixture));
      if (root)
        await fs.writeFile(
          fixture.configPath,
          (await fs.readFile(fixture.configPath, "utf8")).replace(
            'mockupsDir: "mockups"',
            'mockupsDir: "."',
          ),
        );
      const terminal = memoryTerminal({ isTTY: true });
      const running = await serve(
        await loadConfig(fixture.root),
        {
          port: 0,
          watch,
          build: true,
          invocationDirectory: root ? fixture.root : fixture.entriesDir,
        },
        {
          reporter: new RichReporter(terminal.environment),
          watcherFactory: new ResourceWatcherFactory(),
          processSupervisorFactory: new FakeSupervisorFactory(
            new FakeSupervisor(),
          ),
          changeClassifier: {
            async read(_config, manifest) {
              return { baseline: manifest };
            },
          },
        },
      );
      fixture.beforeRemove(() => running.close());
      await waitFor(async () => terminal.stdout().includes("Generated "));
      assert.match(
        terminal.stdout(),
        root
          ? /Generated \d+ files in \. \(/
          : /Generated \d+ files in \.\.\/mockups \(/,
      );
    });
  }
}
