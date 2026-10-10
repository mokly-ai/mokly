import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { repositoryRoot } from "./helpers/fixture.js";
import { styleRouteFixture, withHeadStyles } from "./helpers/style_route.js";

for (const mode of ["committed", "derived"] as const)
  test(`production material detail construction/method probe in ${mode}`, async (context) => {
    const fixture = withHeadStyles(
      await styleRouteFixture(context),
      '<style>.entry{color:red}</style><meta name="before">',
      '<style>.entry{color:blue}</style><meta name="after">',
      mode,
    );
    const directory = await fs.mkdtemp(
      path.join(repositoryRoot, ".context/material-work-probe-"),
    );
    context.after(() => fs.rm(directory, { recursive: true, force: true }));
    const file = path.join(directory, "input.json");
    await fs.writeFile(
      file,
      JSON.stringify({
        ...fixture,
        beforeFiles: [...fixture.beforeFiles],
        afterFiles: [...fixture.afterFiles],
      }),
    );
    const run = async (details: boolean, timings = true) => {
      const { stdout } = await promisify(execFile)(
        process.execPath,
        [
          "--experimental-test-module-mocks",
          "--import",
          "tsx",
          "tests/helpers/material_work_probe.mjs",
          file,
          timings ? "enabled" : "disabled",
        ],
        {
          cwd: repositoryRoot,
          env: { ...process.env, MOKLY_MATERIAL_WORK: details ? "1" : "" },
        },
      );
      return JSON.parse(stdout);
    };
    const off = await run(false);
    const on = await run(true);
    const disabled = await run(true, false);
    assert.equal(off.constructions, 0);
    assert.equal(disabled.constructions, 0);
    assert.equal(on.constructions, 1);
    assert.deepEqual(off.comparisons, on.comparisons);
    assert.deepEqual(disabled.comparisons, on.comparisons);
  });
