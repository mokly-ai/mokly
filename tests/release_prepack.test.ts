import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);

test("CLI prepack prepares the UI package and viewer declarations before a clean consumer typechecks them", async (t) => {
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
      workspaces: ["packages/ui", "packages/viewer", "packages/mokly"],
    }),
  );
  for (const name of ["ui", "viewer", "mokly"]) {
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
          : {}),
      }),
    );
    await write(
      `packages/${name}/build.mjs`,
      `
import fs from "node:fs";
${name === "mokly" ? 'fs.readFileSync("../viewer/dist/index.d.ts");' : ""}
${name === "viewer" ? 'fs.readFileSync("../ui/dist/index.js");' : ""}
fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync("dist/index.js", "export {};\\n");
fs.writeFileSync("dist/index.d.ts", ${JSON.stringify({ ui: "export {};\n", viewer: "export interface View { path: string }\n", mokly: 'export type { View } from "@mokly/viewer";\n' }[name])});
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
    "ui\nviewer\nmokly\n",
  );
  await execute("npm", ["pack", "--pack-destination", archives], {
    cwd: path.join(root, "packages/viewer"),
  });
  await write(
    "consumer/package.json",
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: {
        "@mokly/mokly": "file:../archives/mokly-mokly-0.0.1.tgz",
        "@mokly/viewer": "file:../archives/mokly-viewer-0.0.1.tgz",
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
  for (const name of ["viewer", "mokly"])
    assert.equal(
      (
        await fs.lstat(path.join(consumer, "node_modules/@mokly", name))
      ).isSymbolicLink(),
      false,
    );
});
