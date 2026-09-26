import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { fileExportOperations } from "../dist/export/operations.js";
import { ExportTransaction } from "../dist/export/transaction.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import { writeOwnershipMarker } from "./helpers/ownership_marker.js";

test("a late unowned destination file is restored instead of deleted with backup", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const output = path.join(fixture.root, "site");
  await writeOwned(output, "Previous");
  const transaction = await ExportTransaction.open(output, undefined, {
    ...fileExportOperations,
    rename: async (from, to) => {
      if (from === output)
        await fs.promises.writeFile(path.join(output, "notes.txt"), "Keep me");
      await fs.promises.rename(from, to);
    },
  });
  await writeOwned(transaction.stage, "Next");
  await assert.rejects(transaction.install(), /unowned/);
  assert.equal(
    await fs.promises.readFile(path.join(output, "notes.txt"), "utf8"),
    "Keep me",
  );
  assert.equal(
    await fs.promises.readFile(path.join(output, "index.html"), "utf8"),
    "Previous",
  );
  await transaction.close();
  assert.equal(fs.existsSync(transaction.reservation), false);
});

test("unowned backup additions during install survive cleanup and preserve the installed site", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const output = path.join(fixture.root, "site");
  await writeOwned(output, "Previous");
  const transaction = await ExportTransaction.open(output, undefined, {
    ...fileExportOperations,
    rename: async (from, to) => {
      await fs.promises.rename(from, to);
      if (from.endsWith("/stage"))
        await fs.promises.writeFile(
          path.join(transaction.backup, "notes.txt"),
          "Keep me",
        );
    },
  });
  await writeOwned(transaction.stage, "Next");
  await assert.rejects(transaction.install(), /backup cleanup failed/);
  await assert.rejects(transaction.close(), /recovery files.*retained/);
  assert.equal(
    await fs.promises.readFile(path.join(output, "index.html"), "utf8"),
    "Next",
  );
  assert.equal(
    await fs.promises.readFile(
      path.join(transaction.backup, "notes.txt"),
      "utf8",
    ),
    "Keep me",
  );
});

test("a concurrent destination is retained alongside an unowned captured backup", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const output = path.join(fixture.root, "site");
  await writeOwned(output, "Previous");
  const transaction = await ExportTransaction.open(output, undefined, {
    ...fileExportOperations,
    rename: async (from, to) => {
      await fs.promises.rename(from, to);
      if (from === output) {
        await fs.promises.writeFile(
          path.join(to, "notes.txt"),
          "Captured user data",
        );
        await fs.promises.mkdir(output);
        await fs.promises.writeFile(
          path.join(output, "keep.txt"),
          "New user data",
        );
      }
    },
  });
  await writeOwned(transaction.stage, "Next");
  await assert.rejects(transaction.install(), /rollback failed|recover/);
  await assert.rejects(transaction.close(), /recovery files retained/);
  assert.equal(
    await fs.promises.readFile(path.join(output, "keep.txt"), "utf8"),
    "New user data",
  );
  assert.equal(
    await fs.promises.readFile(
      path.join(transaction.backup, "notes.txt"),
      "utf8",
    ),
    "Captured user data",
  );
});

test("a dangling backup symlink is retained instead of swept away during close", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const transaction = await ExportTransaction.open(
    path.join(fixture.root, "site"),
  );
  const missing = path.join(fixture.root, "missing");
  await fs.promises.symlink(missing, transaction.backup);
  await assert.rejects(transaction.close(), /recovery files retained/);
  assert.equal(await fs.promises.readlink(transaction.backup), missing);
});

test("close preserves a backup introduced after its initial recovery check", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const transaction = await ExportTransaction.open(
    path.join(fixture.root, "site"),
    undefined,
    {
      ...fileExportOperations,
      remove: async (candidate) => {
        await fs.promises.mkdir(transaction.backup);
        await fs.promises.writeFile(
          path.join(transaction.backup, "notes.txt"),
          "Keep me",
        );
        await fs.promises.rm(candidate, { recursive: true, force: true });
      },
    },
  );
  await assert.rejects(transaction.close(), /cleanup failed|recovery/);
  assert.equal(
    await fs.promises.readFile(
      path.join(transaction.backup, "notes.txt"),
      "utf8",
    ),
    "Keep me",
  );
});

async function writeOwned(directory: string, content: string): Promise<void> {
  await fs.promises.mkdir(directory, { recursive: true });
  await fs.promises.writeFile(path.join(directory, "index.html"), content);
  await writeOwnershipMarker(directory);
}
