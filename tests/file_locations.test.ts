import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  createPathLocator,
  locatePath,
} from "../dist/config/file_locations.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import {
  assertOperationScaling,
  countOperations,
} from "./helpers/operation_counts.js";

test("locations retain physical and logical identities below symlinked roots", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const alias = `${fixture.root}-alias`;
  await fs.promises.symlink(fixture.root, alias, "dir");
  context.after(() => fs.promises.rm(alias));
  const root = path.join(alias, "entries");
  for (const relative of ["fixture.mockup.tsx", "missing/input.ts"]) {
    const physicalPath = path.join(fixture.entriesDir, relative);
    const expected = {
      logicalPath: path.join(root, relative),
      physicalPath,
      relativePath: relative,
      physicalRelativePath: relative,
    };
    assert.deepEqual(locatePath(physicalPath, root, alias), expected);
    assert.deepEqual(locatePath(expected.logicalPath, root, alias), expected);
  }
});

test("locations reject escaping and dangling paths without throwing", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const dangling = path.join(fixture.entriesDir, "dangling.ts");
  const escaping = path.join(fixture.entriesDir, "escape");
  await fs.promises.symlink("absent.ts", dangling);
  await fs.promises.symlink(fixture.mockupsDir, escaping, "dir");
  const locate = (candidate: string) =>
    locatePath(candidate, fixture.entriesDir, fixture.root);
  assert.equal(locate(dangling), undefined);
  assert.equal(locate(path.join(dangling, "child.ts")), undefined);
  assert.equal(locate(path.join(escaping, "missing.ts")), undefined);
  assert.equal(locate(path.join(fixture.root, "notes.md")), undefined);
  assert.equal(locate(path.join(fixture.root, "../outside.ts")), undefined);
  assert.equal(
    locatePath(fixture.entryPath, path.dirname(fixture.root), fixture.root),
    undefined,
  );
  assert.equal(
    locatePath(
      path.join(fixture.root, "missing/input.ts"),
      path.join(fixture.root, "missing"),
      fixture.root,
    ),
    undefined,
  );
});

test("locations return undefined when a root lookup fails", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  context.mock.method(fs, "realpathSync", () => {
    throw new Error("root lookup failed");
  });
  assert.equal(locatePath(fixture.entryPath, fixture.root), undefined);
});

test("one locator caches distinct repository and location roots", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const alias = `${fixture.root}-alias`;
  await fs.promises.symlink(fixture.root, alias, "dir");
  context.after(() => fs.promises.rm(alias));
  const root = path.join(alias, "entries");
  const files = Array.from({ length: 40 }, (_, index) => `input-${index}.ts`);
  await Promise.all(
    files.map((file) =>
      fs.promises.writeFile(
        path.join(fixture.entriesDir, file),
        "export default null;",
      ),
    ),
  );
  const collect = (count: number) => {
    const relativePaths = files.slice(0, count);
    const counted = countOperations(() => {
      const locate = createPathLocator(root, alias);
      return relativePaths.map((relative) =>
        locate(path.join(fixture.entriesDir, relative)),
      );
    });
    assert.deepEqual(
      counted.result,
      relativePaths.map((relative) => ({
        logicalPath: path.join(root, relative),
        physicalPath: path.join(fixture.entriesDir, relative),
        relativePath: relative,
        physicalRelativePath: relative,
      })),
    );
    return counted;
  };
  const smaller = collect(10);
  const larger = collect(40);
  assertOperationScaling(
    smaller,
    larger,
    [
      { operation: "realpath", path: alias },
      { operation: "realpath", path: root },
    ],
    [],
  );
});

test("a cached locator checks live candidate aliases after a failed lookup", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const locate = createPathLocator(fixture.entriesDir, fixture.root);
  const alias = path.join(fixture.entriesDir, "input.ts");
  await fs.promises.symlink("fixture.mockup.tsx", alias);
  assert.equal(locate(alias)?.physicalPath, fixture.entryPath);
  await fs.promises.unlink(alias);
  await fs.promises.symlink("absent.ts", alias);
  assert.equal(locate(alias), undefined);
  await fs.promises.unlink(alias);
  await fs.promises.symlink("fixture.mockup.tsx", alias);
  assert.equal(locate(alias)?.physicalPath, fixture.entryPath);
  assert.deepEqual(
    locate(fixture.entryPath),
    locatePath(fixture.entryPath, fixture.entriesDir, fixture.root),
  );
});
