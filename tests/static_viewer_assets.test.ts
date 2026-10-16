import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { platformPackage } from "../packages/mokly/src/platform.mjs";
import { systemRuntime } from "../packages/mokly/src/runtime.mjs";

import { publicationFixture, workspace } from "./helpers/static_publication.js";

test(
  "invalid viewer scripts keep their location and fail before consumer rendering",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture(true);
    const viewer = path.join(root, ".context/viewer");
    try {
      await fs.mkdir(path.join(viewer, "browser"), { recursive: true });
      await fs.mkdir(path.join(viewer, "assets/fonts"), { recursive: true });
      for (const [file, content] of [
        [
          "browser.manifest.json",
          JSON.stringify({
            schemaVersion: 1,
            modules: ["shell.js", "inspector.js"],
          }),
        ],
        ["browser/inspector.js", "export {};"],
        ["shell.css", ""],
        ["assets/brand.svg", "<svg/>"],
        ["assets/fonts/InterVariable.woff2", ""],
      ])
        await fs.writeFile(path.join(viewer, file!), content!);
      const source = path.join(root, "specs/home.mockup.ts");
      const original = await fs.readFile(source);
      for (const [bytes, reason] of [
        [Buffer.from([255]), /not UTF-8/u],
        [Buffer.from("\nconst = syntax"), /shell\.js:2:7/u],
        [Buffer.from("import './missing.js'"), /missing\.js/u],
      ] as const) {
        await fs.writeFile(path.join(viewer, "browser/shell.js"), bytes);
        const runtime = systemRuntime();
        const binary = runtime.nativePackage(
          platformPackage(
            runtime.platform,
            runtime.architecture,
            runtime.glibc,
          ),
        ).binary;
        const result = await new Promise<{ code: number; stderr: string }>(
          (resolve, reject) => {
            execFile(
              binary,
              ["build", "--no-changes"],
              {
                cwd: root,
                env: {
                  ...process.env,
                  MOKLY_OUTPUT: "plain",
                  MOKLY_VIEWER_DIST: viewer,
                  MOKLY_PACKAGE_ROOT: path.join(workspace, "packages/mokly"),
                  MOKLY_NODE_EXECUTABLE: process.execPath,
                },
              },
              (error, _stdout, stderr) => {
                const code = error?.code ?? 0;
                if (typeof code !== "number") reject(error);
                else resolve({ code, stderr });
              },
            );
          },
        );
        assert.equal(result.code, 1);
        assert.match(result.stderr, /\[mokly\/server-failed\]/u);
        assert.match(result.stderr, /mokly-viewer\/client\/shell\.js/u);
        assert.match(result.stderr, reason);
        assert.match(
          result.stderr,
          /Build or reinstall the matching @mokly\/viewer package/u,
        );
        assert.deepEqual(await fs.readFile(source), original);
        await assert.rejects(fs.stat(path.join(root, "mokly-static")), {
          code: "ENOENT",
        });
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
