import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { list } from "tar";

import { repositoryRoot } from "./helpers/fixture.js";

const execFileAsync = promisify(execFile);

test("the site preserves the committed root dependency lists and files allowlist", async () => {
  const fixture = JSON.parse(
    await readFile(
      new URL("./fixtures/site-package-boundary.json", import.meta.url),
      "utf8",
    ),
  ) as {
    sourceCommit: string;
    packageFields: Record<string, unknown>;
  };
  const current = JSON.parse(
    await readFile(path.join(repositoryRoot, "package.json"), "utf8"),
  ) as Record<string, unknown>;
  for (const [field, expected] of Object.entries(fixture.packageFields)) {
    assert.deepEqual(
      current[field] ?? null,
      expected,
      `${field} changed from the pre-site contract at ${fixture.sourceCommit}; dependency maintenance must deliberately update the fixture`,
    );
  }
});

test("the actual published tarball contains no site workspace files", async (t) => {
  const destination = await mkdtemp(
    path.join(os.tmpdir(), "mokly-site-package-"),
  );
  t.after(() => rm(destination, { recursive: true, force: true }));
  const { stdout } = await execFileAsync(
    "npm",
    ["pack", "--json", "--ignore-scripts", "--pack-destination", destination],
    {
      cwd: repositoryRoot,
      maxBuffer: 16 * 1024 * 1024,
      timeout: 60_000,
    },
  );
  const reports = JSON.parse(stdout) as Array<{ filename: string }>;
  assert.equal(reports.length, 1);
  const report = reports[0];
  assert.ok(report);
  const files: string[] = [];
  await list({
    file: path.join(destination, report.filename),
    onReadEntry: (entry) => {
      files.push(entry.path);
    },
  });
  assert.ok(files.includes("package/dist/index.js"));
  assert.ok(files.includes("package/package.json"));
  assert.deepEqual(
    files.filter(
      (file) => file === "package/site" || file.startsWith("package/site/"),
    ),
    [],
  );
});
