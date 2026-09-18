import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { compileCatalogue } from "../src/build/compile.js";
import { writeCompilation } from "../src/build/transaction.js";
import { loadConfig } from "../src/config/load.js";
import { publicationOptions } from "../src/publication/options.js";

import {
  createFixture,
  removeFixture,
  repositoryRoot,
} from "./helpers/fixture.js";

const execute = promisify(execFile);

test("JavaScript publication options enforce the same explicit capability contract", () => {
  assert.deepEqual(publicationOptions(), { includeChanges: false });
  assert.deepEqual(publicationOptions({ includeChanges: true, base: "main" }), {
    includeChanges: true,
    base: "main",
  });
  for (const value of [
    null,
    [],
    true,
    { base: "main" },
    { includeChanges: undefined },
    { includeChanges: "true" },
    { includeChanges: true, base: "" },
    { includeChanges: true, extra: true },
  ])
    assert.throws(() => publicationOptions(value));
});

test("ordinary publication needs no Git and omits review and watch artifacts", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const output = path.join(fixture.root, ".context/published");
  const forbiddenGit = path.join(fixture.root, "bin");
  await fs.promises.mkdir(forbiddenGit);
  await fs.promises.writeFile(
    path.join(forbiddenGit, "git"),
    "#!/bin/sh\necho 'Git must not run' >&2\nexit 99\n",
    { mode: 0o755 },
  );
  await execute(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      'import { loadConfig } from "./dist/config/load.js"; import { buildPreview } from "./scripts/preview/catalogue.mjs"; await buildPreview(await loadConfig(process.argv[1]), process.argv[2]);',
      fixture.root,
      output,
    ],
    { cwd: repositoryRoot, env: { ...process.env, PATH: forbiddenGit } },
  );
  for (const file of [
    "index.html",
    "view/screens/home.html",
    "view/user-flows/tour.html",
    "404.html",
  ]) {
    const html = await fs.promises.readFile(path.join(output, file), "utf8");
    assert.doesNotMatch(
      html,
      /data-mokly-filter|data-diff-screen|client\/browser\.js/,
    );
  }
  for (const file of [
    "__mokly/diffs",
    "__mokly/events",
    "__mokly/client/browser.js",
    "__mokly/client/live_updates.js",
    "__mokly/client/react-shell.js",
  ])
    assert.equal(fs.existsSync(path.join(output, file)), false, file);
  assert.doesNotMatch(
    await fs.promises.readFile(path.join(output, "_redirects"), "utf8"),
    /diffs|events/,
  );
});

test("publication rejects invalid options before loading the consumer", async () => {
  for (const args of [
    ["--base", "main"],
    ["--include-changes", "--include-changes"],
    ["--out"],
    ["--include-changes", "--base"],
    ["--unknown"],
    ["--out", "a", "--out", "b"],
  ]) {
    await assert.rejects(
      execute(process.execPath, ["scripts/preview/build.mjs", ...args], {
        cwd: repositoryRoot,
      }),
      /usage:.*include-changes/s,
    );
  }
});
