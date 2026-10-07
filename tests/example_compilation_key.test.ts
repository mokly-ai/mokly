import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  exampleSnapshotKey,
  exampleSourceFiles,
} from "../scripts/verification/example-snapshot-key.mjs";

const execute = promisify(execFile);

const trackedFiles: Readonly<Record<string, string>> = {
  ".gitignore": "dist/\nexamples/basic/mokly-generated/\n",
  "README.md": "# Fixture\n",
  "docs/protocol/contract.md": "# Contract\n",
  "examples/basic/mokly.config.ts": "export default {};\n",
  "examples/basic/specs/home.mockup.tsx": "export const mockups = [];\n",
  "examples/basic/styles.css": "body { color: black; }\n",
  "examples/imported-assets/signal.png": "png\n",
  "package-lock.json": "{}\n",
  "tsconfig.json": "{}\n",
  "unrelated.txt": "outside the inventory\n",
};

const ignoredFiles: Readonly<Record<string, string>> = {
  "dist/cli/bin.js": "export {};\n",
  "examples/basic/mokly-generated/home/index.html": "<p>Home</p>\n",
  "packages/viewer/dist/data.js": "export {};\n",
};

async function repository(t: test.TestContext): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-snapshot-key-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const [name, contents] of Object.entries({
    ...trackedFiles,
    ...ignoredFiles,
  }))
    await write(root, name, contents);
  await execute("git", ["init", "-q"], { cwd: root });
  await execute("git", ["add", "-A"], { cwd: root });
  return root;
}

async function write(root: string, name: string, contents: string) {
  const target = path.join(root, name);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, contents);
}

test("identical trees give the same key", async (t) => {
  const [first, second] = await Promise.all([repository(t), repository(t)]);
  const key = await exampleSnapshotKey(first);
  assert.match(key, /^[0-9a-f]{64}$/u);
  assert.equal(await exampleSnapshotKey(second), key);
  assert.equal(await exampleSnapshotKey(first), key);
});

const inputChanges: ReadonlyArray<
  readonly [string, (root: string) => Promise<unknown>]
> = [
  [
    "an edited example source",
    (root) =>
      write(root, "examples/basic/mokly.config.ts", "export default { a };\n"),
  ],
  [
    "an edited authored stylesheet",
    (root) => write(root, "examples/basic/styles.css", "body {}\n"),
  ],
  [
    "an edited imported asset",
    (root) => write(root, "examples/imported-assets/signal.png", "changed\n"),
  ],
  [
    "an added untracked example file",
    (root) =>
      write(root, "examples/basic/specs/new.mockup.tsx", "export {};\n"),
  ],
  [
    "a renamed example file",
    (root) =>
      fs.rename(
        path.join(root, "examples/basic/specs/home.mockup.tsx"),
        path.join(root, "examples/basic/specs/start.mockup.tsx"),
      ),
  ],
  [
    "a deleted tracked file",
    (root) => fs.rm(path.join(root, "examples/basic/specs/home.mockup.tsx")),
  ],
  [
    "an edited protocol document",
    (root) => write(root, "docs/protocol/contract.md", "# Changed\n"),
  ],
  ["an edited README", (root) => write(root, "README.md", "# Changed\n")],
  [
    "an edited package build",
    (root) => write(root, "dist/cli/bin.js", "export const a = 1;\n"),
  ],
  [
    "an added viewer build file",
    (root) => write(root, "packages/viewer/dist/new.js", "export {};\n"),
  ],
  [
    "a removed viewer build",
    (root) =>
      fs.rm(path.join(root, "packages/viewer/dist"), { recursive: true }),
  ],
  ["an edited lockfile", (root) => write(root, "package-lock.json", "[]\n")],
  [
    "an edited TypeScript configuration",
    (root) => write(root, "tsconfig.json", "[]\n"),
  ],
];

for (const [name, change] of inputChanges)
  test(`${name} changes the key`, async (t) => {
    const root = await repository(t);
    const before = await exampleSnapshotKey(root);
    await change(root);
    assert.notEqual(await exampleSnapshotKey(root), before);
  });

test("ignored output and files outside the inventory keep the key", async (t) => {
  const root = await repository(t);
  const before = await exampleSnapshotKey(root);
  await write(
    root,
    "examples/basic/mokly-generated/home/index.html",
    "<p>New</p>\n",
  );
  await write(
    root,
    "examples/basic/mokly-generated/about/index.html",
    "<p>A</p>\n",
  );
  await write(root, "unrelated.txt", "changed outside the inventory\n");
  await write(root, "docs/guide.md", "# Not a protocol document\n");
  assert.equal(await exampleSnapshotKey(root), before);
});

test(
  "a symbolic link hashes as its target text, even when it dangles",
  { skip: process.platform === "win32" },
  async (t) => {
    const root = await repository(t);
    const link = path.join(root, "examples/basic/specs/link.mockup.tsx");
    await fs.symlink("absent-first.tsx", link);
    const first = await exampleSnapshotKey(root);
    assert.equal(await exampleSnapshotKey(root), first);
    await fs.rm(link);
    await fs.symlink("absent-second.tsx", link);
    assert.notEqual(await exampleSnapshotKey(root), first);
  },
);

test("the source inventory lists tracked and untracked inputs in code-unit order", async (t) => {
  const root = await repository(t);
  await write(root, "examples/basic/specs/Zeta.mockup.tsx", "export {};\n");
  await fs.rm(path.join(root, "README.md"));
  assert.deepEqual(await exampleSourceFiles(root), [
    "README.md",
    "docs/protocol/contract.md",
    "examples/basic/mokly.config.ts",
    "examples/basic/specs/Zeta.mockup.tsx",
    "examples/basic/specs/home.mockup.tsx",
    "examples/basic/styles.css",
    "examples/imported-assets/signal.png",
  ]);
});
