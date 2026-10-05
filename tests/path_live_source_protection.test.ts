import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { writeCompilation } from "../dist/build/transaction.js";
import { startCatalogueServer } from "../dist/server/http.js";
import { classifyWatchPath } from "../dist/server/watch_events.js";

import { pageSource, pathFixture } from "./helpers/path_fixture.js";

test("new root matches stay private before a candidate can be accepted, including excluded files", async (t) => {
  const fixture = await pathFixture(
    {
      "generated/specs/account/main.mockup.ts": pageSource(),
      "generated/specs/account/_folder.json": '{"exclude":["drafts/**"]}',
    },
    '{mockupsDir:"generated",roots:[{dir:"generated/specs"}],generatedOutput:"committed"}',
  );
  t.after(fixture.remove);
  const config = await fixture.config();
  await writeCompilation(await fixture.compile(), config);
  const server = await startCatalogueServer(config, {
    port: 0,
    base: "HEAD",
    liveChanges: false,
  });
  t.after(() => server.close());
  for (const name of [
    "drafts/secret.mockup.ts",
    "invalid.mockup.ts",
    "notes.md",
  ]) {
    const relative = `specs/account/${name}`;
    await fixture.write(
      `generated/${relative}`,
      "private source that cannot compile",
    );
    assert.equal(
      (await fetch(`${server.url}/static/${relative}`)).status,
      404,
      relative,
    );
    assert.equal(
      classifyWatchPath(
        { path: path.join(config.mockupsDir, relative), kind: "add" },
        config,
      ),
      "rebuild",
    );
  }
  await fs.symlink(
    "specs/account/drafts/secret.mockup.ts",
    path.join(config.mockupsDir, "alias.txt"),
  );
  assert.equal((await fetch(`${server.url}/static/alias.txt`)).status, 404);
  await fixture.write("generated/specs/account/image.svg", "<svg/>");
  assert.equal(
    (await fetch(`${server.url}/static/specs/account/image.svg`)).status,
    200,
  );
});

test("historical resource protection uses the baseline inventory instead of current root membership", async (t) => {
  const { isAuthoringSource } =
    await import("../dist/build/source_inventory.js");
  const { baselineResourceConfig } =
    await import("../dist/review/base_manifest.js");
  const fixture = await pathFixture(
    {
      "generated/specs/main.mockup.ts": pageSource(),
      "generated/specs/notes.md": "Public baseline content",
    },
    '{mockupsDir:"generated",roots:[{dir:"generated/specs",files:["**/*.mockup.ts"]}]}',
  );
  t.after(fixture.remove);
  const baseline = (await fixture.compile()).manifest;
  await fixture.write(
    "mokly.config.ts",
    'export default {mockupsDir:"generated",roots:[{dir:"generated/specs"}]};',
  );
  const current = await fixture.config();
  const filename = path.join(current.mockupsDir, "specs/notes.md");
  assert.ok(isAuthoringSource(filename, current));
  assert.equal(
    isAuthoringSource(
      filename,
      baselineResourceConfig(current, baseline),
      "none",
    ),
    undefined,
  );
});
