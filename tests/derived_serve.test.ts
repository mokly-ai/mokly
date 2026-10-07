import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

import { CachedBaselineBuilder } from "../dist/baseline/rebuild.js";
import { serve } from "../dist/server/serve.js";
import { entryRoute, viewRoute } from "../packages/viewer/dist/data.js";
import { parseRemovedPagePreview } from "../packages/viewer/dist/review/page_preview.js";
import { parseReviewResult } from "../packages/viewer/dist/review/result_validation.js";

import { processExists } from "./helpers/blocking_git.js";
import { derivedFixture } from "./helpers/derived_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";
import { removedDeliverySource } from "./helpers/removed_delivery_fixture.js";

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
          `${running.url}/mokly-viewer/diffs/review.json`,
        );
        assert.equal(unselected.status, 200, await unselected.clone().text());
        await assert.rejects(fs.stat(fixture.mockupsDir), { code: "ENOENT" });
        assert.equal(
          parseReviewResult(await unselected.json()).baseCommit,
          fixture.commit,
        );
        await fs.mkdir(path.join(fixture.mockupsDir, "mokly-generated/home"), {
          recursive: true,
        });
        await fs.writeFile(
          path.join(fixture.config.generatedDir, "home/index.mobile.html"),
          "wrong local bytes",
        );
        const response = await fetch(
          `${running.url}/mokly-viewer/diffs/review.json?path=home`,
        );
        assert.equal(response.status, 200, await response.clone().text());
        const result = parseReviewResult(await response.json());
        assert.equal(result.baseCommit, fixture.commit);
        const view = result.screens[0]!.views.find(
          (view) => view.viewport === "mobile",
        )!;
        assert.match(
          await (
            await fetch(
              new URL(
                `snapshots/after/mokly-generated/${viewRoute("home", view.viewport, view.colorScheme)}`,
                response.url,
              ),
            )
          ).text(),
          /Derived source edit/,
        );
        assert.doesNotMatch(
          await (
            await fetch(
              new URL(
                `snapshots/before/mokly-generated/${viewRoute("home", view.viewport, view.colorScheme)}`,
                response.url,
              ),
            )
          ).text(),
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

for (const watch of [false, true]) {
  test(
    `serve --build writes only complete compilations (watch=${watch})`,
    { timeout: 30000 },
    async (context) => {
      const fixture = await derivedFixture(context);
      await fs.rm(fixture.mockupsDir, { recursive: true });
      const running = await serve(fixture.config, {
        port: 0,
        watch,
        build: true,
      });
      try {
        const file = path.join(
          fixture.mockupsDir,
          "mokly-generated/home/index.mobile.html",
        );
        const initial = await waitFor(() => readOutput(file));
        assert.match(initial, /<main id="home-mobile">/u);
        if (watch) {
          await fs.writeFile(
            fixture.entryPath,
            validEntrySource({ body: "Watched successful build" }),
          );
          const updated = await waitFor(async () => {
            const current = await readOutput(file);
            return current?.includes("Watched successful build")
              ? current
              : undefined;
          });
          assert.notEqual(updated, initial);
        }
      } finally {
        await running.close();
      }
    },
  );
}

test(
  "derived Serve captures a removed page from its prepared baseline only",
  { timeout: 30_000 },
  async (t) => {
    const fixture = await derivedFixture(t, removedDeliverySource(false), {
      "assets/page.css":
        '@import "./nested.css"; body { background: url("./past.png"); }',
      "assets/nested.css": "main { color: rebeccapurple; }",
      "assets/past.png": "historical image bytes",
    });
    await fs.writeFile(fixture.entryPath, removedDeliverySource(true));
    await fs.rm(fixture.mockupsDir, { recursive: true });
    const running = await serve(fixture.config, {
      base: "origin/main",
      port: 0,
      watch: false,
    });
    try {
      await waitFor(async () => {
        const page = await (await fetch(running.url)).text();
        return page.includes('data-changes-status="ready"') ? page : undefined;
      });
      t.mock.method(CachedBaselineBuilder.prototype, "build", async () => {
        throw new Error("HTTP must never rebuild a baseline");
      });
      const response = await fetch(
        `${running.url}/mokly-viewer/diffs/review.json?page=fixture/deleted-archive/deleted-section/removed-page`,
      );
      assert.equal(response.status, 200, await response.clone().text());
      const preview = parseRemovedPagePreview(await response.json());
      assert.equal(preview.baseCommit, fixture.commit);
      assert.equal(
        preview.path,
        "fixture/deleted-archive/deleted-section/removed-page",
      );
      assert.match(
        await (
          await fetch(
            new URL(
              `snapshots/before/mokly-generated/${entryRoute(preview.path)}`,
              response.url,
            ),
          )
        ).text(),
        /Previous page/,
      );
    } finally {
      await running.close();
    }
  },
);

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
      assert.equal((await fetch(`${running.url}/view/home/`)).status, 200);
    } finally {
      await running.close();
    }
  },
);

async function readOutput(file: string): Promise<string | undefined> {
  try {
    return await fs.readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function waitFor<T>(read: () => Promise<T | undefined>): Promise<T> {
  for (let attempt = 0; attempt < 200; attempt++) {
    const value = await read();
    if (value !== undefined) return value;
    await setTimeout(50);
  }
  throw new Error("Derived Serve did not settle");
}
