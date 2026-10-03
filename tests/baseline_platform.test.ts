import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { nodeBaselineBuilder } from "./helpers/baseline_builders.js";

test(
  "native npm and npx rebuild an archived catalogue with spaces in its path",
  { timeout: 30000 },
  async (t) => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "mokly baseline platform "),
    );
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const execute = promisify(execFile);
    const git = (...args: string[]) => execute("git", args, { cwd: root });
    await fs.writeFile(path.join(root, ".gitignore"), ".mokly-cache/\n");
    await fs.writeFile(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "baseline-platform",
        version: "1.0.0",
        private: true,
        scripts: { "build:baseline": "node build.cjs" },
      }),
    );
    await fs.writeFile(
      path.join(root, "package-lock.json"),
      JSON.stringify({
        name: "baseline-platform",
        version: "1.0.0",
        lockfileVersion: 3,
        packages: { "": { name: "baseline-platform", version: "1.0.0" } },
      }),
    );
    await fs.writeFile(
      path.join(root, "build.cjs"),
      `const fs = require("node:fs");
fs.mkdirSync("mockups");
fs.writeFileSync("mockups/mokly-manifest.json", JSON.stringify({ schemaVersion: 8, generatedBy: "mokly", sourceFiles: [], entries: [] }));
fs.writeFileSync("mockups/page.html", "Historical output");
`,
    );
    await git("init", "-q");
    await git("config", "user.name", "Mokly test");
    await git("config", "user.email", "mokly@example.invalid");
    await git("add", ".");
    await git("-c", "commit.gpgsign=false", "commit", "-qm", "test: baseline");
    const commit = (await git("rev-parse", "HEAD")).stdout.trim();
    const builder = nodeBaselineBuilder();
    const request = {
      repoRoot: root,
      commit,
      mockupsPath: "mockups",
      commands: [
        ["npm", "ci", "--ignore-scripts", "--no-audit", "--no-fund"],
        ["npm", "run", "build:baseline"],
        ["npx", "--no-install", "--version"],
      ],
    };
    const result = await builder.build(request);
    assert.equal(
      await fs.readFile(path.join(result.outputDir, "page.html"), "utf8"),
      "Historical output",
    );
    assert.equal((await builder.build(request)).cacheHit, true);
    assert.equal((await git("status", "--porcelain")).stdout.trim(), "");
  },
);
