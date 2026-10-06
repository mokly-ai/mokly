import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { unsupportedSourceMap } from "./helpers/css_source_maps.js";
import {
  createFixture,
  removeFixture,
  repositoryRoot,
} from "./helpers/fixture.js";
import { entryStyle } from "./helpers/imported_styles_fixture.js";

const execFileAsync = promisify(execFile);

test("Build ignores sibling source map files from any working directory", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  for (const name of ["fixture.css", "fixture.module.css"]) {
    await fs.writeFile(
      path.join(fixture.entriesDir, name),
      `.card{color:red}\n/*# sourceMappingURL=${name}.map */\n`,
    );
    await fs.writeFile(
      path.join(fixture.entriesDir, `${name}.map`),
      unsupportedSourceMap,
    );
    await fs.appendFile(fixture.entryPath, `\nimport "./${name}";\n`);
  }
  const stylesheetPath = path.join(fixture.mockupsDir, entryStyle);
  const stylesheets: string[] = [];
  for (const cwd of [fixture.root, os.tmpdir()]) {
    await execFileAsync(
      process.execPath,
      [
        path.join(repositoryRoot, "dist/cli/bin.js"),
        "build",
        "--config",
        fixture.configPath,
      ],
      { cwd, timeout: 120_000 },
    );
    stylesheets.push(await fs.readFile(stylesheetPath, "utf8"));
    await fs.rm(stylesheetPath);
  }
  assert.equal(stylesheets[1], stylesheets[0]);
  assert.match(stylesheets[0]!, /\.card \{/);
  assert.match(stylesheets[0]!, /\.mokly_[a-f0-9]{12}_card \{/);
  assert.doesNotMatch(stylesheets[0]!, /sourceMappingURL/);
  const manifest = JSON.parse(
    await fs.readFile(
      path.join(fixture.mockupsDir, "mokly-manifest.json"),
      "utf8",
    ),
  ) as { sourceFiles: string[] };
  assert.deepEqual(
    manifest.sourceFiles.filter((file) => file.endsWith(".map")),
    [],
  );
});
