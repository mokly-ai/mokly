import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { isCancellation } from "../dist/errors.js";
import { fileExportOperations } from "../dist/export/operations.js";
import { ExportTransaction } from "../dist/export/transaction.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import { writeOwnershipMarker } from "./helpers/ownership_marker.js";

test("export reserves one writer, restores failed installs, and cleans its stage", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const output = path.join(fixture.root, "site");
  await fs.promises.mkdir(output);
  await fs.promises.writeFile(path.join(output, "index.html"), "Previous");
  await writeOwnershipMarker(output);
  const transaction = await ExportTransaction.open(output, {
    ...fileExportOperations,
    rename: async (from, to) => {
      if (from.endsWith("/stage"))
        throw new Error("injected installation failure");
      await fs.promises.rename(from, to);
    },
  });
  await assert.rejects(
    ExportTransaction.open(output),
    /reservation unavailable/,
  );
  await fs.promises.writeFile(
    path.join(transaction.stage, "index.html"),
    "Next",
  );
  await assert.rejects(transaction.install(), /previous output was restored/);
  assert.equal(
    await fs.promises.readFile(path.join(output, "index.html"), "utf8"),
    "Previous",
  );
  await transaction.close();
  assert.equal(fs.existsSync(transaction.reservation), false);
});

test("failed rollback retains the previous site and reservation for recovery", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const output = path.join(fixture.root, "site");
  await fs.promises.mkdir(output);
  const transaction = await ExportTransaction.open(output, {
    ...fileExportOperations,
    rename: async (from, to) => {
      if (from === output) return fs.promises.rename(from, to);
      throw new Error("injected failure");
    },
  });
  await assert.rejects(transaction.install(), /rollback failed/);
  await assert.rejects(transaction.close(), /recovery files retained/);
  assert.ok(fs.existsSync(transaction.backup));
});

test("cleanup failures accurately identify an installed site and retained backup", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const output = path.join(fixture.root, "site");
  await fs.promises.mkdir(output);
  const transaction = await ExportTransaction.open(output, {
    ...fileExportOperations,
    rmdir: async () => {
      throw new Error("injected cleanup failure");
    },
  });
  await fs.promises.writeFile(
    path.join(transaction.stage, "index.html"),
    "Installed",
  );
  await assert.rejects(
    transaction.install(),
    /Export installed, but backup cleanup failed/,
  );
  await assert.rejects(transaction.close(), /Export installed, but.*retained/);
  assert.equal(
    await fs.promises.readFile(path.join(output, "index.html"), "utf8"),
    "Installed",
  );
  assert.ok(fs.existsSync(transaction.backup));
});

test("cancellation during replacement restores the previous output", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const output = path.join(fixture.root, "site");
  await fs.promises.mkdir(output);
  const controller = new AbortController();
  const transaction = await ExportTransaction.open(output, {
    ...fileExportOperations,
    rename: async (from, to) => {
      await fs.promises.rename(from, to);
      if (from === output) controller.abort();
    },
  });
  await fs.promises.writeFile(
    path.join(transaction.stage, "index.html"),
    "Next",
  );
  await assert.rejects(
    transaction.install(controller.signal),
    (error: unknown) => {
      assert.equal(isCancellation(error), true);
      assert.equal(
        (error as Error).message,
        "[mokly/export-invalid] Could not install export; the previous output was restored. [mokly/export-invalid] Export cancelled; retry when ready.",
      );
      return true;
    },
  );
  assert.deepEqual(await fs.promises.readdir(output), []);
  await transaction.close();
});

test("failed cancellation rollback is recovery, not cancellation", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const output = path.join(fixture.root, "site");
  await fs.promises.mkdir(output);
  const controller = new AbortController();
  const transaction = await ExportTransaction.open(output, {
    ...fileExportOperations,
    rename: async (from, to) => {
      if (from === transaction.backup)
        throw new Error("injected restore failure");
      await fs.promises.rename(from, to);
      if (from === output) controller.abort();
    },
  });
  await fs.promises.writeFile(
    path.join(transaction.stage, "index.html"),
    "Next",
  );
  await assert.rejects(transaction.install(controller.signal), (error) => {
    assert.equal(isCancellation(error), false);
    assert.match((error as Error).message, /Export rollback failed/u);
    assert.match((error as Error).message, new RegExp(transaction.backup, "u"));
    return true;
  });
  await assert.rejects(transaction.close(), /recovery files retained/u);
});

test("cancellation without previous output keeps its install wrapper marked", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const output = path.join(fixture.root, "site");
  const abort = new Error("injected stage cancellation");
  abort.name = "AbortError";
  const transaction = await ExportTransaction.open(output, {
    ...fileExportOperations,
    rename: async (from, to) => {
      if (from === transaction.stage) throw abort;
      await fs.promises.rename(from, to);
    },
  });
  await fs.promises.writeFile(
    path.join(transaction.stage, "index.html"),
    "Next",
  );
  await assert.rejects(transaction.install(), (error) => {
    assert.equal(isCancellation(error), true);
    assert.equal(
      (error as Error).message,
      "[mokly/export-invalid] Could not install export; no previous output was moved. injected stage cancellation",
    );
    assert.equal((error as Error).cause, abort);
    return true;
  });
  await transaction.close();
});

test("backup cleanup failure outranks a later cancellation", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const output = path.join(fixture.root, "site");
  await fs.promises.mkdir(output);
  const controller = new AbortController();
  const transaction = await ExportTransaction.open(output, {
    ...fileExportOperations,
    rename: async (from, to) => {
      await fs.promises.rename(from, to);
      if (from === transaction.stage) controller.abort();
    },
    rmdir: async (candidate) => {
      if (candidate === transaction.backup)
        throw new Error("injected backup cleanup failure");
      await fs.promises.rmdir(candidate);
    },
  });
  await fs.promises.writeFile(
    path.join(transaction.stage, "index.html"),
    "Next",
  );
  await assert.rejects(transaction.install(controller.signal), (error) => {
    assert.equal(isCancellation(error), false);
    assert.match((error as Error).message, /backup cleanup failed/u);
    assert.match((error as Error).message, new RegExp(transaction.backup, "u"));
    return true;
  });
  await assert.rejects(transaction.close(), /recovery files retained/u);
});
