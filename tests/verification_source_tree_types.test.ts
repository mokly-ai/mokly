import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  fingerprintRecords,
  type SourceTreeRecord,
} from "../scripts/verification/source-tree.mjs";

import { typeRepository } from "./helpers/source_tree_types.js";

test("file to directory keeps the committed fingerprint with a base index", async (context) => {
  const fixture = await typeRepository(context);
  await fixture.write("a", "base\n");
  const base = await fixture.commit();
  await fs.rm(path.join(fixture.root, "a"));
  await fixture.write("a/b", "changed\n");
  await fixture.boxState(base);
  const before = await fixture.fingerprint();
  await fixture.git("add", "-A");
  assert.equal(before, await fixture.fingerprint());
});

test("directory to file keeps the committed fingerprint with a base index", async (context) => {
  const fixture = await typeRepository(context);
  await fixture.write("x/y", "base\n");
  const base = await fixture.commit();
  await fs.rm(path.join(fixture.root, "x"), { recursive: true });
  await fixture.write("x", "changed\n");
  await fixture.boxState(base);
  const before = await fixture.fingerprint();
  await fixture.git("add", "-A");
  assert.equal(before, await fixture.fingerprint());
});

test("a leading directory symlink cannot add a cached descendant to the fingerprint", async (context) => {
  const fixture = await typeRepository(context);
  await fixture.write("x/y", "base\n");
  await fixture.write("target/y", "target\n");
  const base = await fixture.commit();
  await fs.rm(path.join(fixture.root, "x"), { recursive: true });
  await fs.symlink("target", path.join(fixture.root, "x"));
  await fixture.boxState(base);
  const before = await fixture.fingerprint();
  await fixture.git("add", "-A");
  assert.equal(before, await fixture.fingerprint());
});

test("a nested repository replacing a cached file is rejected without an untracked entry", async (context) => {
  const fixture = await typeRepository(context);
  await fixture.write("a", "base\n");
  const base = await fixture.commit();
  await fs.rm(path.join(fixture.root, "a"));
  await fixture.nested("a");
  await fixture.boxState(base);
  assert.equal(
    await fixture.git("ls-files", "--others", "--exclude-standard"),
    "",
  );
  await assert.rejects(
    fixture.fingerprint(),
    /unsupported file type at "a"; ignore or remove a nested repository or worktree/u,
  );
});

test("a nested repository inside a directory replacing a cached file is rejected", async (context) => {
  const fixture = await typeRepository(context);
  await fixture.write("a", "base\n");
  const base = await fixture.commit();
  await fs.rm(path.join(fixture.root, "a"));
  await fixture.nested("a/child");
  await fixture.boxState(base);
  await assert.rejects(
    fixture.fingerprint(),
    /unsupported file type.*ignore or remove a nested repository or worktree/u,
  );
});

test("ordinary changes keep the exact legacy record fingerprint before and after staging", async (context) => {
  const fixture = await typeRepository(context);
  await fixture.write("a", "base\n");
  await fixture.write("remove", "deleted\n");
  await fixture.write(".gitignore", "ignored/\n");
  const base = await fixture.commit();
  await fixture.write("a", "changed\n");
  await fs.chmod(path.join(fixture.root, "a"), 0o755);
  await fs.rm(path.join(fixture.root, "remove"));
  await fixture.write("new", "added\n");
  await fs.symlink("missing", path.join(fixture.root, "link"));
  await fixture.boxState(base);
  await fixture.write("untracked", "untracked\n");
  await fixture.write("ignored/output", "ignored\n");
  const inputs = [
    [".gitignore", "100644", "ignored/\n"],
    ["a", "100755", "changed\n"],
    ["new", "100644", "added\n"],
    ["link", "120000", "missing"],
    ["untracked", "100644", "untracked\n"],
  ];
  const records: SourceTreeRecord[] = inputs.map(([name, mode, content]) => ({
    path: Buffer.from(name!),
    mode: mode as SourceTreeRecord["mode"],
    digest: createHash("sha256").update(content!).digest("hex"),
  }));
  const expected = fingerprintRecords(records);
  assert.equal(await fixture.fingerprint(), expected);
  await fixture.git("add", "-A");
  assert.equal(await fixture.fingerprint(), expected);
});

test("an empty plain directory replacing a cached file counts as a deletion", async (context) => {
  const fixture = await typeRepository(context);
  await fixture.write("a", "base\n");
  const base = await fixture.commit();
  await fs.rm(path.join(fixture.root, "a"));
  await fixture.boxState(base);
  const deleted = await fixture.fingerprint();
  await fs.mkdir(path.join(fixture.root, "a"));
  assert.equal(await fixture.fingerprint(), deleted);
});
