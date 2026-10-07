import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { entryStyle } from "./helpers/imported_styles_fixture.js";
import {
  startWatchMatrix,
  watchMatrixFixture,
} from "./helpers/watch_matrix.js";

for (const command of ["Build", "Serve"] as const) {
  test(`${command} shared setup rebuilds imported helpers and PostCSS additions`, async (t) => {
    const fixture = await watchMatrixFixture(t);
    const running = await startWatchMatrix(command, fixture);
    const helper = path.join(fixture.root, "shared.ts");
    const content = path.join(fixture.root, "content");
    assert.ok(running.factory.watchers[0]?.targets.includes(helper));
    assert.ok(running.factory.watchers[0]?.targets.includes(content));
    let previous = running.accepted.length;
    await fs.writeFile(helper, 'export const label = "Changed label";');
    running.notify(helper);
    await running.next(previous);
    assert.match(
      String(running.writes.at(-1)?.outputs.get("home/index.mobile.html")),
      /Changed label/,
    );
    previous = running.accepted.length;
    const added = path.join(content, "second.txt");
    await fs.writeFile(added, "beta");
    running.notify(added, "add");
    await running.next(previous);
    assert.match(
      String(running.writes.at(-1)?.outputs.get(entryStyle)),
      /alpha beta/,
    );
    await running.close();
  });

  test(`${command} shared setup discovers Markdown and folder metadata`, async (t) => {
    const fixture = await watchMatrixFixture(t);
    const running = await startWatchMatrix(command, fixture);
    const folder = path.join(fixture.entriesDir, "docs");
    await fs.mkdir(folder);
    const document = path.join(folder, "guide.md");
    let previous = running.accepted.length;
    await fs.writeFile(document, "# Shared guide\n\nRead this.");
    running.notify(document, "add");
    await running.next(previous);
    assert.ok(
      running.accepted
        .at(-1)
        ?.entries.some(
          (entry) => entry.path === "docs/guide" && entry.kind === "document",
        ),
    );
    previous = running.accepted.length;
    const metadata = path.join(folder, "_folder.json");
    await fs.writeFile(metadata, JSON.stringify({ title: "Reference" }));
    running.notify(metadata, "add");
    await running.next(previous);
    assert.equal(
      running.accepted.at(-1)?.folders.find((item) => item.path === "docs")
        ?.title,
      "Reference",
    );
    await running.close();
  });

  test(`${command} shared setup adopts configuration and replacement resource targets`, async (t) => {
    const fixture = await watchMatrixFixture(t);
    const running = await startWatchMatrix(command, fixture);
    const original = running.factory.watchers[0]!;
    const previous = running.accepted.length;
    await fs.writeFile(
      fixture.configPath,
      (await fs.readFile(fixture.configPath, "utf8")).replace(
        '"public.css"',
        '"alternate.css"',
      ),
    );
    running.notify(fixture.configPath);
    await running.next(previous);
    assert.equal(original.closeCount, 1);
    assert.ok(
      running.observing(path.join(fixture.mockupsDir, "alternate.css")).length,
    );
    assert.match(
      String(running.writes.at(-1)?.outputs.get("home/index.mobile.html")),
      /alternate\.css/,
    );
    await running.close();
  });
}
