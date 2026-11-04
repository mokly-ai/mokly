import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);

test("CLI prepack prepares UI, model, frame, and viewer declarations before a clean consumer typechecks them", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-prepack-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const write = async (file: string, content: string) => {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), content);
  };
  await write(
    "package.json",
    JSON.stringify({
      private: true,
      workspaces: [
        "packages/ui",
        "packages/model",
        "packages/frame",
        "packages/viewer",
        "packages/mokly",
      ],
    }),
  );
  const declarations = {
    ui: "export {};\n",
    model: "export interface ModelView { path: string }\n",
    frame: 'export type { ModelView as FrameView } from "@mokly/model";\n',
    viewer: 'export type { FrameView as View } from "@mokly/frame";\n',
    mokly: 'export type { View } from "@mokly/viewer";\n',
  };
  for (const name of ["ui", "model", "frame", "viewer", "mokly"] as const) {
    await write(
      `packages/${name}/package.json`,
      JSON.stringify({
        name: `@mokly/${name}`,
        version: "0.0.1",
        type: "module",
        files: ["dist"],
        exports: {
          ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
        },
        scripts: {
          build: "node build.mjs",
          ...(name === "mokly" ? { prepack: "node scripts/prepack.mjs" } : {}),
        },
        ...(name === "mokly"
          ? { dependencies: { "@mokly/viewer": "0.0.1" } }
          : name === "viewer"
            ? {
                dependencies: {
                  "@mokly/model": "0.0.1",
                  "@mokly/frame": "0.0.1",
                },
              }
            : name === "frame"
              ? { dependencies: { "@mokly/model": "0.0.1" } }
              : {}),
      }),
    );
    await write(
      `packages/${name}/build.mjs`,
      `
import fs from "node:fs";
${name === "mokly" ? 'fs.readFileSync("../viewer/dist/index.d.ts");' : ""}
${name === "viewer" ? 'fs.readFileSync("../ui/dist/index.js");' : ""}
${name === "viewer" ? 'fs.readFileSync("../model/dist/index.d.ts");' : ""}
${name === "viewer" ? 'fs.readFileSync("../frame/dist/index.d.ts");' : ""}
${name === "frame" ? 'fs.readFileSync("../model/dist/index.d.ts");' : ""}
fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync("dist/index.js", "export {};\\n");
fs.writeFileSync("dist/index.d.ts", ${JSON.stringify(declarations[name])});
fs.appendFileSync("../../order.txt", "${name}\\n");
`,
    );
  }
  await write(
    "packages/mokly/scripts/prepack.mjs",
    await fs.readFile(
      path.join(repositoryRoot, "packages/mokly/scripts/prepack.mjs"),
      "utf8",
    ),
  );
  await execute(
    "npm",
    ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund"],
    { cwd: root },
  );
  const archives = path.join(root, "archives");
  await fs.mkdir(archives);
  await execute("npm", ["pack", "--pack-destination", archives], {
    cwd: path.join(root, "packages/mokly"),
  });
  assert.equal(
    await fs.readFile(path.join(root, "order.txt"), "utf8"),
    "ui\nmodel\nframe\nviewer\nmokly\n",
  );
  for (const name of ["model", "frame", "viewer"])
    await execute("npm", ["pack", "--pack-destination", archives], {
      cwd: path.join(root, "packages", name),
    });
  await write(
    "consumer/package.json",
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: {
        "@mokly/mokly": "file:../archives/mokly-mokly-0.0.1.tgz",
        "@mokly/viewer": "file:../archives/mokly-viewer-0.0.1.tgz",
        "@mokly/model": "file:../archives/mokly-model-0.0.1.tgz",
        "@mokly/frame": "file:../archives/mokly-frame-0.0.1.tgz",
      },
    }),
  );
  const consumer = path.join(root, "consumer");
  await execute(
    "npm",
    ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund"],
    { cwd: consumer },
  );
  await write(
    "consumer/check.ts",
    'import type { View } from "@mokly/mokly"; const view: View = { path: "screen" }; void view;\n',
  );
  await execute(
    process.execPath,
    [
      path.join(repositoryRoot, "node_modules/typescript/bin/tsc"),
      "--noEmit",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "--strict",
      "check.ts",
    ],
    { cwd: consumer },
  );
  for (const name of ["model", "frame", "viewer", "mokly"])
    assert.equal(
      (
        await fs.lstat(path.join(consumer, "node_modules/@mokly", name))
      ).isSymbolicLink(),
      false,
    );
});
