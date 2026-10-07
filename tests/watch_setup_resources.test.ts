import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  startWatchMatrix,
  watchMatrixFixture,
} from "./helpers/watch_matrix.js";
import { waitFor } from "./server_fixture.js";

for (const command of ["Build", "Serve"] as const) {
  test(`${command} shared setup observes referenced HTML PDF and nested CSS edits`, async (t) => {
    const fixture = await watchMatrixFixture(t);
    const running = await startWatchMatrix(command, fixture);
    for (const [name, bytes] of [
      [
        "guide.html",
        '<link rel="stylesheet" href="guide.css"><p>Revised guide</p>',
      ],
      ["guide.pdf", "%PDF-1.4\nrevised"],
      ["guide.css", "p{color:orange}"],
    ] as const) {
      const file = path.join(fixture.mockupsDir, name);
      assert.ok(
        running
          .observing(file)
          .some((watcher) => watcher.options?.followSymlinks === false),
      );
      const previous = running.accepted.length;
      await fs.writeFile(file, bytes);
      running.notify(file);
      await running.next(previous);
    }
    await running.close();
  });

  test(`${command} shared setup retains missing CSS targets until repair`, async (t) => {
    const fixture = await watchMatrixFixture(t);
    const running = await startWatchMatrix(command, fixture);
    const nested = path.join(fixture.mockupsDir, "nested.css");
    const missing = path.join(fixture.mockupsDir, "future/theme.css");
    const previous = running.accepted.length;
    await fs.writeFile(nested, '@import "future/theme.css";');
    running.notify(nested);
    if (command === "Build")
      await waitFor(async () => running.diagnostics.length > 0);
    else await running.next(previous);
    assert.ok(
      running.observing(missing).length,
      "missing authored paths remain observable",
    );
    const beforeRepair = running.accepted.length;
    await fs.mkdir(path.dirname(missing));
    await fs.writeFile(missing, "main{color:navy}");
    running.notify(missing, "add");
    await running.next(beforeRepair);
    assert.ok(running.observing(missing).length);
    await running.close();
  });
}
