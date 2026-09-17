import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

import { CachedBaselineBuilder } from "../dist/baseline/rebuild.js";
import { serve } from "../dist/server/serve.js";
import { parseReviewResult } from "../packages/viewer/dist/review/result_validation.js";

import { processExists } from "./helpers/blocking_git.js";
import { derivedFixture } from "./helpers/derived_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";

for (const watch of [false, true]) {
  test(
    `derived Serve smoke (watch=${watch}) classifies and serves compiled selected snapshots`,
    { timeout: 30000 },
    async (t) => {
      const fixture = await derivedFixture(t);
      await fs.writeFile(
        fixture.entryPath,
        validEntrySource({ body: "Derived source edit" }),
      );
      await fs.rm(fixture.mockupsDir, { recursive: true });
      const running = await serve(fixture.config, { port: 0, watch });
      try {
        assert.equal((await fetch(running.url)).status, 200);
        const html = await waitFor(async () => {
          const page = await (await fetch(running.url)).text();
          return page.includes('data-changes-status="ready"')
            ? page
            : undefined;
        });
        assert.match(html, /data-changed="true"[^>]*data-entry-id="home"/);
        t.mock.method(CachedBaselineBuilder.prototype, "build", async () => {
          throw new Error("HTTP must never rebuild a baseline");
        });
        const unselected = await fetch(
          `${running.url}/__mokly/diffs/review.json`,
        );
        assert.equal(unselected.status, 200, await unselected.clone().text());
        assert.equal(
          parseReviewResult(await unselected.json()).baseCommit,
          fixture.commit,
        );
        await fs.writeFile(
          path.join(fixture.mockupsDir, "screens/home.mobile.html"),
          "wrong local bytes",
        );
        const response = await fetch(
          `${running.url}/__mokly/diffs/review.json?route=screens%2Fhome.html`,
        );
        assert.equal(response.status, 200, await response.clone().text());
        const result = parseReviewResult(await response.json());
        assert.equal(result.baseCommit, fixture.commit);
        const view = result.screens[0]!.views.find(
          (view) => view.viewport === "mobile",
        )!;
        assert.match(
          await (await fetch(new URL(view.afterPath!, response.url))).text(),
          /Derived source edit/,
        );
        assert.doesNotMatch(
          await (await fetch(new URL(view.beforePath!, response.url))).text(),
          /Derived source edit/,
        );
        assert.equal(
          (await fetch(`${running.url}/static/.mokly-cache/private`)).status,
          404,
        );
      } finally {
        await running.close();
      }
    },
  );
}

test(
  "Serve shutdown cancels and drains a baseline process that ignores TERM",
  { timeout: 20000 },
  async (t) => {
    const fixture = await derivedFixture(t);
    const pidFile = path.join(fixture.root, "baseline-pid");
    const config = {
      ...fixture.config,
      review: {
        ...fixture.config.review,
        baselineBuild: [
          [
            "node",
            "-e",
            `require('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid)); process.on('SIGTERM',()=>{}); setInterval(()=>{},1000);`,
          ],
        ],
      },
    };
    const running = await serve(config, { port: 0, watch: false });
    let closing: Promise<void> | undefined;
    const close = () => (closing ??= running.close());
    try {
      const pid = Number(
        await waitFor(() =>
          fs.readFile(pidFile, "utf8").catch(() => undefined),
        ),
      );
      assert.equal(processExists(pid), true);
      assert.equal((await fetch(running.url)).status, 200);
      await close();
      assert.equal(processExists(pid), false);
      const entry = path.join(
        fixture.root,
        ".mokly-cache/baselines",
        fixture.commit,
      );
      for (const name of ["lock", "source", "complete.json"])
        assert.equal(
          await fs.stat(path.join(entry, name)).catch(() => undefined),
          undefined,
        );
    } finally {
      await close();
    }
  },
);

test(
  "failed preparation leaves Changes unavailable and All usable",
  { timeout: 20000 },
  async (t) => {
    const fixture = await derivedFixture(t);
    const config = {
      ...fixture.config,
      review: {
        ...fixture.config.review,
        baselineBuild: [["node", "-e", "process.exit(5)"]],
      },
    };
    const running = await serve(config, { port: 0, watch: false });
    try {
      const html = await waitFor(async () => {
        const page = await (await fetch(running.url)).text();
        return page.includes('data-changes-status="unavailable"')
          ? page
          : undefined;
      });
      assert.doesNotMatch(
        html,
        /baseline-command-failed|process\.exit|\.mokly-cache/,
      );
      assert.equal(
        (await fetch(`${running.url}/view/screens/home.html`)).status,
        200,
      );
    } finally {
      await running.close();
    }
  },
);

async function waitFor<T>(read: () => Promise<T | undefined>): Promise<T> {
  for (let attempt = 0; attempt < 200; attempt++) {
    const value = await read();
    if (value !== undefined) return value;
    await setTimeout(50);
  }
  throw new Error("Derived Serve did not settle");
}
