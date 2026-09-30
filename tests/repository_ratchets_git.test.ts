import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runRepositoryRatchets } from "../scripts/verification/repository-ratchets.mjs";

const legacyModule =
  "export const knownUnused = 1;\n" + "void 0;\n".repeat(300);
const longProtocolDocument =
  "# Long contract\n" + "contract line\n".repeat(250);

test("repository ratchets stay anchored when origin/main moves", async (context) => {
  const fixture = await createDivergedRepository();
  context.after(() => fs.rm(fixture.root, { force: true, recursive: true }));

  assert.equal(
    git(fixture.root, "merge-base", "HEAD", "origin/main").trim(),
    fixture.branchPoint,
  );
  const result = captureRatchets(fixture.root);
  assert.equal(result.passed, true, result.output);
  assert.match(
    result.output,
    /Public package export ratchet passed \(0 released package baseline\(s\); 0 noted removal\(s\)\)/u,
  );
});

test("file-length ratchet rejects every JavaScript module extension", async (context) => {
  const fixture = await createDivergedRepository();
  context.after(() => fs.rm(fixture.root, { force: true, recursive: true }));

  for (const extension of ["js", "mjs", "cjs"]) {
    await context.test(extension, async () => {
      const relative = `scripts/too-long.${extension}`;
      const absolute = path.join(fixture.root, relative);
      await fs.writeFile(absolute, "void 0;\n".repeat(301));
      const result = captureRatchets(fixture.root);
      assert.equal(result.passed, false);
      assert.match(
        result.output,
        new RegExp(`${escapeRegex(relative)}.*301.*300`, "u"),
      );
      await fs.rm(absolute);
    });
  }
});

test("unused-export ratchet rejects every JavaScript module extension", async (context) => {
  const fixture = await createDivergedRepository();
  context.after(() => fs.rm(fixture.root, { force: true, recursive: true }));

  for (const extension of ["js", "mjs", "cjs"]) {
    await context.test(extension, async () => {
      const relative = `scripts/new-unused.${extension}`;
      const absolute = path.join(fixture.root, relative);
      await fs.writeFile(
        absolute,
        extension === "cjs"
          ? "exports.newlyUnused = 1;\n"
          : "export const newlyUnused = 1;\n",
      );
      const result = captureRatchets(fixture.root);
      assert.equal(result.passed, false);
      assert.match(
        result.output,
        new RegExp(
          `new unused internal export: ${escapeRegex(relative)}#newlyUnused`,
          "u",
        ),
      );
      await fs.rm(absolute);
    });
  }
});

test("moving a capped protocol document into a subfolder keeps its cap", async (context) => {
  const fixture = await createDivergedRepository();
  context.after(() => fs.rm(fixture.root, { force: true, recursive: true }));
  const nested = path.join(fixture.root, "docs/protocol/nested");
  await fs.mkdir(nested, { recursive: true });
  await fs.rename(
    path.join(fixture.root, "docs/protocol/long.md"),
    path.join(nested, "long.md"),
  );
  await fs.writeFile(
    path.join(nested, "long.md"),
    `${longProtocolDocument}one more line\n`,
  );
  await fs.writeFile(
    path.join(fixture.root, "tests/protocol_doc_sizes.test.ts"),
    'const oversizedCaps = { "nested/long.md": 252 };\n',
  );
  git(fixture.root, "add", "--all");

  const result = captureRatchets(fixture.root);
  assert.equal(result.passed, false);
  assert.match(
    result.output,
    /nested\/long\.md: cap 252 exceeds predecessor long\.md cap 251/u,
  );
});

async function createDivergedRepository() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-ratchets-"));
  await Promise.all([
    fs.mkdir(path.join(root, "docs/protocol"), { recursive: true }),
    fs.mkdir(path.join(root, "docs/protocol/fixtures"), { recursive: true }),
    fs.mkdir(path.join(root, "packages/viewer"), { recursive: true }),
    fs.mkdir(path.join(root, "scripts"), { recursive: true }),
    fs.mkdir(path.join(root, "tests"), { recursive: true }),
    fs.mkdir(path.join(root, "xtask"), { recursive: true }),
  ]);
  await Promise.all([
    fs.writeFile(
      path.join(root, "package.json"),
      '{ "name": "ratchet-fixture", "exports": {} }\n',
    ),
    fs.writeFile(
      path.join(root, "release-please-config.json"),
      '{ "packages": { ".": {}, "packages/viewer": {} } }\n',
    ),
    fs.writeFile(
      path.join(root, ".release-please-manifest.json"),
      '{ ".": "0.0.0", "packages/viewer": "0.0.0" }\n',
    ),
    fs.writeFile(
      path.join(root, "packages/viewer/package.json"),
      '{ "name": "ratchet-viewer-fixture", "exports": {} }\n',
    ),
    fs.writeFile(
      path.join(root, "docs/protocol/npm-release-notes.md"),
      "# Release notes\n",
    ),
    fs.writeFile(path.join(root, "scripts/legacy.mjs"), legacyModule),
    fs.writeFile(
      path.join(root, "docs/protocol/long.md"),
      longProtocolDocument,
    ),
    fs.writeFile(
      path.join(root, "docs/protocol/fixtures/ignored.md"),
      "fixture line\n".repeat(400),
    ),
    fs.writeFile(
      path.join(root, "tests/protocol_doc_sizes.test.ts"),
      'const oversizedCaps = { "long.md": 251 };\n',
    ),
    fs.writeFile(
      path.join(root, "xtask/unused-internal-exports.txt"),
      "scripts/legacy.mjs#knownUnused\n",
    ),
  ]);
  git(root, "init", "--quiet", "--initial-branch=feature");
  git(root, "config", "user.name", "Ratchet Tests");
  git(root, "config", "user.email", "ratchets@example.invalid");
  git(root, "add", ".");
  git(root, "commit", "--quiet", "-m", "test: branch point");
  const branchPoint = git(root, "rev-parse", "HEAD").trim();
  git(root, "branch", "main");
  await fs.writeFile(path.join(root, "feature.txt"), "feature branch\n");
  git(root, "add", "feature.txt");
  git(root, "commit", "--quiet", "-m", "test: feature work");
  git(root, "switch", "--quiet", "main");
  await Promise.all([
    fs.rm(path.join(root, "scripts/legacy.mjs")),
    fs.writeFile(
      path.join(root, "docs/protocol/long.md"),
      "# Shorter contract\n" + "contract line\n".repeat(249),
    ),
    fs.writeFile(
      path.join(root, "tests/protocol_doc_sizes.test.ts"),
      "const oversizedCaps = {};\n",
    ),
    fs.writeFile(path.join(root, "xtask/unused-internal-exports.txt"), ""),
  ]);
  git(root, "add", "--all");
  git(root, "commit", "--quiet", "-m", "test: advance main");
  git(root, "update-ref", "refs/remotes/origin/main", "HEAD");
  git(root, "switch", "--quiet", "feature");
  return { branchPoint, root };
}

function captureRatchets(root: string) {
  const output: string[] = [];
  const original = console.error;
  console.error = (...values: unknown[]) => output.push(values.join(" "));
  try {
    const passed = runRepositoryRatchets(root);
    return { output: output.join("\n"), passed };
  } finally {
    console.error = original;
  }
}

function git(root: string, ...args: string[]) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
