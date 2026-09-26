import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { fileExportOperations } from "../dist/export/operations.js";
import { ExportTransaction } from "../dist/export/transaction.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import { writeOwnershipMarker } from "./helpers/ownership_marker.js";

test("destination creation during initial ownership inspection cannot be adopted", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const output = path.join(fixture.root, "site");
  let inspected = false;
  await assert.rejects(
    ExportTransaction.open(output, undefined, {
      ...fileExportOperations,
      lstat: async (candidate) => {
        const stat = await fileExportOperations.lstat(candidate);
        if (candidate === output && !inspected) {
          inspected = true;
          await fs.promises.mkdir(output);
        }
        return stat;
      },
    }),
    /destination.*changed/i,
  );
  assert.deepEqual(await fs.promises.readdir(output), []);
});

for (const kind of ["empty", "owned"] as const) {
  test(`an initially absent output never adopts a late ${kind} directory`, async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const output = path.join(fixture.root, "site");
    const transaction = await ExportTransaction.open(output);
    await writeOwned(transaction.stage, "Next");
    await fs.promises.mkdir(output);
    if (kind === "owned") await writeOwned(output, "Concurrent export");
    const identity = await fileExportOperations.lstat(output);

    await assert.rejects(transaction.install(), /destination.*changed/i);
    assert.equal(
      (await fileExportOperations.lstat(output))?.ino,
      identity?.ino,
    );
    if (kind === "owned")
      assert.equal(await readIndex(output), "Concurrent export");
    else assert.deepEqual(await fs.promises.readdir(output), []);
    assert.equal(fs.existsSync(transaction.backup), false);
    await transaction.close();
  });
}

for (const timing of ["before install", "during capture"] as const) {
  test(`a different owned output ${timing} is preserved, not discarded`, async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const output = path.join(fixture.root, "site");
    const saved = path.join(fixture.root, "saved");
    await writeOwned(output, "Original export");
    const replace = async () => {
      await fs.promises.rename(output, saved);
      await writeOwned(output, "Concurrent export");
    };
    const transaction = await ExportTransaction.open(output, undefined, {
      ...fileExportOperations,
      rename: async (from, to) => {
        if (from === output && timing === "during capture") await replace();
        await fileExportOperations.rename(from, to);
      },
    });
    await writeOwned(transaction.stage, "Next");
    if (timing === "before install") await replace();

    await assert.rejects(transaction.install(), /destination.*changed/i);
    assert.equal(await readIndex(output), "Concurrent export");
    assert.equal(await readIndex(saved), "Original export");
    await transaction.close();
  });
}

test("removing the initially inspected directory does not authorize a fresh install", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const output = path.join(fixture.root, "site");
  await fs.promises.mkdir(output);
  const transaction = await ExportTransaction.open(output);
  await fs.promises.rmdir(output);
  await assert.rejects(transaction.install(), /destination.*changed/i);
  assert.equal(fs.existsSync(output), false);
  await transaction.close();
});

for (const existed of [false, true]) {
  test(`an empty output created at the install operation survives (previous=${existed})`, async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const output = path.join(fixture.root, "site");
    if (existed) await writeOwned(output, "Previous");
    let lateIdentity: Awaited<ReturnType<typeof fileExportOperations.lstat>>;
    const transaction = await ExportTransaction.open(output, undefined, {
      ...fileExportOperations,
      rename: async (from, to) => {
        if (path.basename(from) === "stage") {
          await fs.promises.mkdir(output);
          lateIdentity = await fileExportOperations.lstat(output);
        }
        await fileExportOperations.rename(from, to);
      },
    });
    await writeOwned(transaction.stage, "Next");
    await assert.rejects(
      transaction.install(),
      /Could not install|rollback failed/,
    );
    assert.equal(
      (await fileExportOperations.lstat(output))?.ino,
      lateIdentity?.ino,
    );
    assert.deepEqual(await fs.promises.readdir(output), []);
    if (existed) {
      assert.equal(await readIndex(transaction.backup), "Previous");
      await assert.rejects(transaction.close(), /recovery files retained/);
    } else await transaction.close();
  });
}

test("an empty output created at the restore operation is never replaced", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const output = path.join(fixture.root, "site");
  await writeOwned(output, "Previous");
  let lateIdentity: Awaited<ReturnType<typeof fileExportOperations.lstat>>;
  const transaction = await ExportTransaction.open(output, undefined, {
    ...fileExportOperations,
    rename: async (from, to) => {
      if (path.basename(from) === "stage") throw new Error("Install failed");
      if (path.basename(from) === "backup") {
        await fs.promises.mkdir(output);
        lateIdentity = await fileExportOperations.lstat(output);
      }
      await fileExportOperations.rename(from, to);
    },
  });
  await assert.rejects(transaction.install(), /rollback failed/);
  assert.equal(
    (await fileExportOperations.lstat(output))?.ino,
    lateIdentity?.ino,
  );
  assert.deepEqual(await fs.promises.readdir(output), []);
  assert.equal(await readIndex(transaction.backup), "Previous");
  await assert.rejects(transaction.close(), /recovery files retained/);
});

async function writeOwned(directory: string, contents: string): Promise<void> {
  await fs.promises.mkdir(directory, { recursive: true });
  await fs.promises.writeFile(path.join(directory, "index.html"), contents);
  await writeOwnershipMarker(directory);
}

async function readIndex(directory: string): Promise<string> {
  return fs.promises.readFile(path.join(directory, "index.html"), "utf8");
}
