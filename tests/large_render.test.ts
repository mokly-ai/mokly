import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { platformPackage } from "../packages/mokly/src/platform.mjs";
import { systemRuntime } from "../packages/mokly/src/runtime.mjs";
import type { EntryDetailV3 } from "../packages/viewer/src/generated/catalogue/EntryDetailV3.js";
import { prepareFixture } from "../scripts/large/setup.js";

import { repositoryRoot } from "./helpers/fixture.js";

const run = promisify(execFile);
async function inventory(root: string) {
  const files = await fs.readdir(root, {
    recursive: true,
    withFileTypes: true,
  });
  const result: Record<string, string> = {};
  for (const file of files.filter((file) => file.isFile())) {
    const absolute = path.join(file.parentPath, file.name);
    result[path.relative(root, absolute)] = createHash("sha256")
      .update(await fs.readFile(absolute))
      .digest("hex");
  }
  return result;
}

test(
  "HTML and React fixtures build real views, usage, resources and stable output",
  { timeout: 300_000 },
  async (t) => {
    for (const variant of ["html", "react"] as const) {
      const root = await fs.mkdtemp(
        path.join(repositoryRoot, ".context/large-render-"),
      );
      t.after(() => fs.rm(root, { recursive: true, force: true }));
      const fixture = await prepareFixture(
        repositoryRoot,
        {
          areas: 1,
          screens: 3,
          rows: 2,
          stylesheets: 2,
          stylesheetShare: 0.34,
        },
        variant,
        "workspace",
        root,
      );
      const runtime = systemRuntime();
      const binary = runtime.nativePackage(
        platformPackage(runtime.platform, runtime.architecture, runtime.glibc),
      ).binary;
      const build = async () =>
        run(
          binary,
          [
            "build",
            "--config",
            fixture.configPath,
            "--strict",
            "--no-changes",
            "--sidecars",
            "1",
          ],
          {
            cwd: root,
            timeout: 120_000,
            env: {
              ...process.env,
              MOKLY_OUTPUT: "plain",
              MOKLY_PACKAGE_ROOT: path.join(repositoryRoot, "packages/mokly"),
              MOKLY_VIEWER_DIST: path.join(
                repositoryRoot,
                "packages/viewer/dist",
              ),
              MOKLY_NODE_EXECUTABLE: process.execPath,
              ...(variant === "html"
                ? { MOKLY_NODE_EXECUTABLE: "/no-sidecar-may-start" }
                : {}),
            },
          },
        );
      await build();
      const output = path.join(root, "mokly-static");
      const index = JSON.parse(
        await fs.readFile(path.join(output, "mokly-viewer/index.json"), "utf8"),
      );
      assert.equal(
        index.screens.length +
          index.components.length +
          index.useCases.length +
          index.pages.length +
          index.documents.length,
        fixture.routes,
      );
      assert.equal(index.screens.length, 3);
      assert.equal(index.components.length, 8);
      assert.equal(index.documents.length, 1);
      assert.equal(index.documents[0].path, "area-1/handbook");
      assert.equal(index.documents[0].documentKeys.length, 2);
      for (const suffix of ["", ".dark"]) {
        const html = await fs.readFile(
          path.join(
            output,
            `static/mokly-generated/area-1/handbook/index${suffix}.html`,
          ),
          "utf8",
        );
        assert.match(html, /Activity handbook/);
        assert.match(html, /data-mokly-link/);
      }
      const prefix = "area-1/screens/activity-group-1";
      const detail = JSON.parse(
        await fs.readFile(
          path.join(output, `mokly-viewer/entries/${prefix}/screen-1.json`),
          "utf8",
        ),
      ) as EntryDetailV3;
      assert.equal(detail.views.length, 4);
      for (const view of detail.views) {
        assert.equal(view.usage.status, "ready");
        if (view.usage.status !== "ready") throw new Error("usage missing");
        assert.ok(view.usage.instances.length >= 4);
        assert.ok(view.usage.slots.length > 0);
      }
      for (let i = 1; i <= 3; i++) {
        const html = await fs.readFile(
          path.join(
            output,
            `static/mokly-generated/${prefix}/screen-${i}/index.desktop.html`,
          ),
          "utf8",
        );
        assert.match(html, /data-mokly-link/);
        assert.ok(!html.includes("tokens-dark.css"));
        const dark = await fs.readFile(
          path.join(
            output,
            `static/mokly-generated/${prefix}/screen-${i}/index.desktop.dark.html`,
          ),
          "utf8",
        );
        assert.ok(dark.includes("tokens-dark.css"));
        assert.match(html, /assets\/mark.svg/);
        assert.equal(html.match(/role="row"/g)?.length, 2);
        assert.match(html, /mokly-slot:start id="r-\d+" instance="r-\d+"/);
        for (const sheet of [1, 2])
          assert.equal(html.includes(`shared-${sheet}.css`), i <= 2);
        if (variant === "react")
          assert.match(html, /\[stylesheet-group="[0-9]"\]/);
      }
      const first = await inventory(output);
      assert.equal(
        Object.keys(first).filter(
          (file) =>
            file.startsWith("static/mokly-generated/area-") &&
            file.endsWith(".html"),
        ).length,
        fixture.documents,
      );
      await build();
      assert.deepEqual(await inventory(output), first);
      assert.equal(
        (await run("git", ["ls-files", "--", "node_modules"], { cwd: root }))
          .stdout,
        "",
      );
      assert.equal(
        (await run("git", ["status", "--porcelain"], { cwd: root })).stdout,
        " M assets/shared-1.css\n",
      );
    }
  },
);
