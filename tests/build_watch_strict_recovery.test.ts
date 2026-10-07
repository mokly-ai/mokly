import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import type { Compilation } from "../dist/build/compile.js";
import { watchBuild } from "../dist/cli/build_watch.js";
import { PlainReporter } from "../dist/cli/reporter/plain.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import { registerWarningPage } from "./helpers/link_control_warning_fixture.js";
import { ResourceWatcherFactory } from "./helpers/resource_watcher.js";
import { memoryTerminal } from "./helpers/terminal.js";
import { waitFor } from "./server_fixture.js";

test("watched strict Build observes a repair in a newly imported warning source", async (t) => {
  const fixture = await createFixture(undefined, {
    extraConfig: "watch: { debounceMs: 0 },",
  });
  t.after(() => removeFixture(fixture));
  const watchers = new ResourceWatcherFactory();
  const terminal = memoryTerminal({ isTTY: false });
  const writes: Compilation[] = [];
  const watching = watchBuild(
    await loadConfig(fixture.root),
    fixture.root,
    new PlainReporter(terminal.environment),
    watchers,
    {
      check() {},
      async write(compilation) {
        writes.push(compilation);
      },
    },
    true,
  );
  try {
    await waitFor(async () => writes.length === 1);
    const imported = await registerWarningPage(fixture);
    watchers.watchers
      .find((watcher) => !watcher.closeCount)!
      .change(fixture.entryPath);
    await waitFor(async () =>
      terminal.stderr().includes("1 build warning with --strict"),
    );
    assert.equal(
      writes.length,
      1,
      "strict warnings must retain the accepted output",
    );
    const observer = watchers.watchers.find(
      (watcher) => !watcher.closeCount && watcher.targets.includes(imported),
    );
    assert.ok(
      observer,
      "the failed candidate's new source must remain a recovery target",
    );
    await fs.writeFile(
      imported,
      (await fs.readFile(imported, "utf8"))
        .replace("<button>", "<div>")
        .replace("</button>", "</div>"),
    );
    observer.change(imported);
    await waitFor(async () => writes.length === 2);
    assert.equal(writes[1]?.diagnostics.length, 0);
    assert.ok(writes[1]?.manifest.sourceFiles.includes("warning.source.tsx"));
  } finally {
    process.emit("SIGTERM");
    await watching;
  }
  assert.ok(watchers.watchers.every((watcher) => watcher.closeCount === 1));
});

test("watched strict Build retains imported recovery inputs after its first warning", async (t) => {
  const fixture = await createFixture(undefined, {
    extraConfig: "watch: { debounceMs: 0 },",
  });
  t.after(() => removeFixture(fixture));
  const imported = await registerWarningPage(fixture);
  const watchers = new ResourceWatcherFactory();
  const terminal = memoryTerminal({ isTTY: false });
  let writes = 0;
  const watching = watchBuild(
    await loadConfig(fixture.root),
    fixture.root,
    new PlainReporter(terminal.environment),
    watchers,
    {
      check() {},
      async write() {
        writes++;
      },
    },
    true,
  );
  try {
    await waitFor(async () =>
      terminal.stderr().includes("1 build warning with --strict"),
    );
    const observer = watchers.watchers.find(
      (watcher) => !watcher.closeCount && watcher.targets.includes(imported),
    );
    assert.ok(
      observer,
      "initial strict failure must not replace the known inventory with bare config",
    );
    await fs.writeFile(
      imported,
      (await fs.readFile(imported, "utf8"))
        .replace("<button>", "<div>")
        .replace("</button>", "</div>"),
    );
    observer.change(imported);
    await waitFor(async () => writes === 1);
  } finally {
    process.emit("SIGTERM");
    await watching;
  }
});
