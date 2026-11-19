import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { viteFixture, viteScreenFile } from "./fixtures/vite/support.js";
import { reportDuration } from "./helpers/durations.js";

test(
  "mokly build uses app Vite aliases, env files, raw imports, React, and SVGR",
  { timeout: 60_000 },
  async (context) => {
    await reportDuration(
      "Vite CLI build",
      (line) => context.diagnostic(line),
      async () => {
        const fixture = await viteFixture(context);
        const built = spawnSync(
          process.execPath,
          [
            path.resolve("packages/mokly/bin/mokly.mjs"),
            "build",
            "--no-changes",
            "--out",
            fixture.output,
          ],
          {
            cwd: fixture.root,
            encoding: "utf8",
            env: { ...process.env, MOKLY_OUTPUT: "plain" },
          },
        );
        assert.equal(built.status, 0, built.stderr + built.stdout);
        const html = await fs.readFile(viteScreenFile(fixture.output), "utf8");
        assert.match(html, /<h1>alias from Vite<\/h1>/);
        assert.match(html, /<p>env from Vite<\/p>/);
        assert.match(html, /<pre>raw from Vite\n<\/pre>/);
        assert.match(html, /<svg[^>]*data-vite-icon="svgr"/);
        assert.match(html, /<main data-vite-renderer="alias from Vite"/);
      },
    );
  },
);
