import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { repositoryRoot } from "./helpers/fixture.js";
import { createTurboFixture } from "./helpers/turbo_fixture.js";

const execute = promisify(execFile);

test("real lifecycle packing preserves JSON stdout and builds both packages", async (context) => {
  const root = await createTurboFixture(context, true);
  const destination = path.join(root, ".context/archives");
  await fs.mkdir(destination, { recursive: true });
  for (const workspace of ["", "packages/viewer"]) {
    let stdout: string;
    try {
      ({ stdout } = await execute(
        "npm",
        ["pack", "--json", "--pack-destination", destination],
        {
          cwd: path.join(root, workspace),
          maxBuffer: 8_000_000,
          timeout: 120_000,
          env: {
            ...process.env,
            TURBO_CACHE: "local:rw",
            TURBO_TELEMETRY_DISABLED: "1",
          },
        },
      ));
    } finally {
      await execute("git", ["diff", "--exit-code", "AGENTS.md"], {
        cwd: repositoryRoot,
      });
    }
    const reports = JSON.parse(stdout) as {
      name: string;
      filename: string;
      files: { path: string }[];
    }[];
    assert.equal(reports.length, 1);
    assert.equal(
      reports[0]!.name,
      workspace ? "@mokly/viewer" : "@mokly/mokly",
    );
    assert.ok(reports[0]!.files.some((file) => file.path === "dist/index.js"));
    await fs.access(path.join(root, workspace, "dist/index.js"));
    await fs.access(path.join(destination, reports[0]!.filename));
  }
});
