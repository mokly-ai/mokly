import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  captureRatchets,
  createDivergedRepository,
  git,
} from "./helpers/repository_ratchets.js";

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
    `# Long contract\n${"contract line\n".repeat(250)}one more line\n`,
  );
  await fs.writeFile(
    path.join(fixture.root, "xtask/protocol-document-caps.json"),
    '{ "nested/long.md": 252 }\n',
  );
  git(fixture.root, "add", "--all");

  const result = captureRatchets(fixture.root);
  assert.equal(result.passed, false);
  assert.match(
    result.output,
    /nested\/long\.md: cap 252 exceeds predecessor long\.md cap 251/u,
  );
});

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
