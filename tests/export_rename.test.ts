import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import koffi from "koffi";

import { fileExportOperations } from "../packages/mokly/dist/export/operations.js";
import { ExportTransaction } from "../packages/mokly/dist/export/transaction.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

for (const kind of ["empty", "populated", "file", "symlink"] as const) {
  test(`exclusive export rename preserves a competing ${kind} destination`, async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const from = path.join(fixture.root, "stage");
    const to = path.join(fixture.root, "destination");
    await fs.promises.mkdir(from);
    await fs.promises.writeFile(path.join(from, "index.html"), "Next");
    if (kind === "file") await fs.promises.writeFile(to, "Keep");
    else if (kind === "symlink")
      await fs.promises.symlink(
        path.join(fixture.root, "missing"),
        to,
        "junction",
      );
    else {
      await fs.promises.mkdir(to);
      if (kind === "populated")
        await fs.promises.writeFile(path.join(to, "notes.txt"), "Keep");
    }
    const before = await fileExportOperations.lstat(to);
    await assert.rejects(fileExportOperations.rename(from, to));
    assert.equal((await fileExportOperations.lstat(to))?.ino, before?.ino);
    assert.equal(
      await fs.promises.readFile(path.join(from, "index.html"), "utf8"),
      "Next",
    );
    if (kind === "file")
      assert.equal(await fs.promises.readFile(to, "utf8"), "Keep");
    if (kind === "populated")
      assert.equal(
        await fs.promises.readFile(path.join(to, "notes.txt"), "utf8"),
        "Keep",
      );
  });
}

test("exclusive export rename installs an entire directory at a Unicode path", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const from = path.join(fixture.root, "stágé 🧪");
  const to = path.join(fixture.root, "sité 🧪");
  await fs.promises.mkdir(from);
  await fs.promises.writeFile(path.join(from, "index.html"), "Next");
  const before = await fileExportOperations.lstat(from);
  await fileExportOperations.rename(from, to);
  assert.equal((await fileExportOperations.lstat(to))?.ino, before?.ino);
  assert.equal(
    await fs.promises.readFile(path.join(to, "index.html"), "utf8"),
    "Next",
  );
  assert.equal(fs.existsSync(from), false);
});

test("native bridge failure leaves existing output in place without a fallback", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const output = path.join(fixture.root, "site");
  await fs.promises.mkdir(output);
  const before = await fileExportOperations.lstat(output);
  const transaction = await ExportTransaction.open(output);
  context.mock.method(koffi, "load", () => {
    throw new Error("Native helper unavailable");
  });
  await assert.rejects(
    transaction.install(),
    /Exclusive export rename is unavailable/,
  );
  assert.equal((await fileExportOperations.lstat(output))?.ino, before?.ino);
  assert.equal(fs.existsSync(transaction.backup), false);
  await transaction.close();
});

test("exclusive export rename rejects NUL paths without truncating at the native boundary", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const from = path.join(fixture.root, "stage");
  const to = path.join(fixture.root, "site");
  await fs.promises.mkdir(from);
  await assert.rejects(
    fileExportOperations.rename(`${from}\0ignored`, to),
    /NUL-free/,
  );
  await assert.rejects(
    fileExportOperations.rename(from, `${to}\0ignored`),
    /NUL-free/,
  );
  await assert.rejects(
    fileExportOperations.rename(from, "relative"),
    /absolute/,
  );
  assert.ok(fs.existsSync(from));
  assert.equal(fs.existsSync(to), false);
});
