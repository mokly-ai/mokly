import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { browse } from "../../scripts/large/browse.js";
import { start, stop, waitFor } from "../../scripts/large/process.js";
import { prepareFixture } from "../../scripts/large/setup.js";
import { repositoryRoot } from "../helpers/fixture.js";

import { test } from "./browser_test.js";

test("startup completes with real previews while full Serve requires available Changes", async ({
  browser,
}) => {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/large-startup-"),
  );
  try {
    const fixture = await prepareFixture(
      repositoryRoot,
      { areas: 1, screens: 2, rows: 1 },
      "html",
      "workspace",
      root,
    );
    const running = start(
      [
        path.join(root, "node_modules/@mokly/mokly/bin/mokly.mjs"),
        "serve",
        "--config",
        fixture.configPath,
        "--base",
        "refs/mokly/startup-no-base",
        "--port",
        "0",
      ],
      root,
      0,
    );
    try {
      const match = await waitFor(
        running,
        /Mokly listening at (http:\/\/127\.0\.0\.1:\d+)/,
      );
      for (const scope of ["startup", "serve"] as const) {
        const context = await browser.newContext({
          viewport: { width: 1440, height: 1000 },
        });
        context.setDefaultTimeout(60_000);
        try {
          const measured = browse(
            context,
            match[1]!,
            fixture,
            performance.now(),
            scope,
          );
          if (scope === "serve") {
            await assert.rejects(measured, /Delivered Changes is unavailable/);
          } else {
            const result = await measured;
            assert.equal(typeof result.usableMs, "number");
            assert.ok(result.bytes > 0);
            assert.equal(typeof result.propsMs, "number");
            assert.equal("changesReadyMs" in result, false);
            assert.equal("reviewAvailableMs" in result, false);
            assert.equal("review" in result, false);
            assert.ok(
              context
                .pages()
                .some((page) => page.url().endsWith("/view/area-1/guide/")),
            );
          }
        } finally {
          await context.close();
        }
      }
    } finally {
      await stop(running);
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
