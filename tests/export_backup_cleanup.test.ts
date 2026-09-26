import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { fileExportOperations } from "../dist/export/operations.js";
import {
  ExportTransaction,
  TRANSACTION_MARKER,
} from "../dist/export/transaction.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import { writeOwnershipMarker } from "./helpers/ownership_marker.js";

test("late unlisted files during deletion stop backup cleanup without being deleted", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const output = path.join(fixture.root, "site");
  await fs.promises.mkdir(path.join(output, "nested"), { recursive: true });
  await fs.promises.writeFile(path.join(output, "nested/owned.txt"), "Owned");
  await writeOwnershipMarker(output);
  let recursiveBackupRemovals = 0;
  const transaction = await ExportTransaction.open(output, undefined, {
    ...fileExportOperations,
    unlink: async (candidate) => {
      if (candidate.endsWith("/nested/owned.txt"))
        await fs.promises.writeFile(
          path.join(transaction.backup, "nested/notes.txt"),
          "Keep me",
        );
      await fs.promises.unlink(candidate);
    },
    remove: async (candidate) => {
      if (candidate === transaction.backup) recursiveBackupRemovals++;
      await fileExportOperations.remove(candidate);
    },
  });
  await fs.promises.writeFile(
    path.join(transaction.stage, "index.html"),
    "Installed",
  );
  await assert.rejects(transaction.install(), /backup cleanup failed/);
  await assert.rejects(transaction.close(), /recovery files.*retained/);
  assert.equal(
    await fs.promises.readFile(
      path.join(transaction.backup, "nested/notes.txt"),
      "utf8",
    ),
    "Keep me",
  );
  assert.equal(
    await fs.promises.readFile(path.join(output, "index.html"), "utf8"),
    "Installed",
  );
  assert.equal(recursiveBackupRemovals, 0);
});

test("rollback leaves even an empty concurrently recreated destination untouched", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const output = path.join(fixture.root, "site");
  await fs.promises.mkdir(output);
  let replacementInode: number | undefined;
  const transaction = await ExportTransaction.open(output, undefined, {
    ...fileExportOperations,
    rename: async (from, to) => {
      if (from.endsWith("/stage")) {
        await fs.promises.mkdir(output);
        replacementInode = (await fs.promises.lstat(output)).ino;
        throw new Error("Injected install failure");
      }
      await fs.promises.rename(from, to);
    },
  });
  await assert.rejects(transaction.install(), /destination was recreated/);
  await assert.rejects(transaction.close(), /recovery files retained/);
  assert.equal((await fs.promises.lstat(output)).ino, replacementInode);
  assert.ok(fs.existsSync(transaction.backup));
});

test("transaction setup preserves its original failure when partial-stage cleanup fails", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const original = new Error("Injected marker write failure");
  const writeFile = fs.promises.writeFile;
  context.mock.method(
    fs.promises,
    "writeFile",
    async (...args: Parameters<typeof writeFile>) => {
      if (String(args[0]).endsWith(TRANSACTION_MARKER)) throw original;
      return writeFile(...args);
    },
  );
  await assert.rejects(
    ExportTransaction.open(path.join(fixture.root, "site"), undefined, {
      ...fileExportOperations,
      remove: async () => {
        throw new Error("Injected close failure");
      },
    }),
    (error: unknown) => {
      assert.match(String(error), /Injected marker write failure/);
      assert.match(String(error), /cleanup failed/);
      assert.ok(
        error instanceof Error && error.cause instanceof AggregateError,
      );
      assert.equal(error.cause.errors[0], original);
      return true;
    },
  );
});

test("a destination populated after the recovery check is not overwritten by rename", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const output = path.join(fixture.root, "site");
  await fs.promises.mkdir(output);
  const transaction = await ExportTransaction.open(output, undefined, {
    ...fileExportOperations,
    rename: async (from, to) => {
      if (from.endsWith("/stage")) throw new Error("Injected install failure");
      if (from.endsWith("/backup")) {
        await fs.promises.mkdir(output);
        await fs.promises.writeFile(path.join(output, "notes.txt"), "Keep me");
      }
      await fs.promises.rename(from, to);
    },
  });
  await assert.rejects(transaction.install(), /rollback failed/);
  await assert.rejects(transaction.close(), /recovery files retained/);
  assert.equal(
    await fs.promises.readFile(path.join(output, "notes.txt"), "utf8"),
    "Keep me",
  );
  assert.ok(fs.existsSync(transaction.backup));
});

test("a symlink captured instead of a directory is retained for manual recovery", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const output = path.join(fixture.root, "site");
  const missing = path.join(fixture.root, "missing");
  await fs.promises.mkdir(output);
  const transaction = await ExportTransaction.open(output, undefined, {
    ...fileExportOperations,
    rename: async (from, to) => {
      if (from === output) {
        await fs.promises.rename(output, path.join(fixture.root, "saved"));
        await fs.promises.symlink(missing, output);
      }
      await fs.promises.rename(from, to);
    },
  });
  await assert.rejects(transaction.install(), /backup is not a real directory/);
  await assert.rejects(transaction.close(), /recovery files retained/);
  assert.equal(await fs.promises.readlink(transaction.backup), missing);
  assert.equal(fs.existsSync(output), false);
});

test("successful reservation cleanup remains safe to retry", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const transaction = await ExportTransaction.open(
    path.join(fixture.root, "site"),
  );
  await transaction.close();
  await transaction.close();
  assert.equal(fs.existsSync(transaction.reservation), false);
});
