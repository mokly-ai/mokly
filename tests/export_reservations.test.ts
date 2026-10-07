import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { RESERVATION_DIRECTORY } from "../dist/export/reservation.js";
import { ExportTransaction } from "../dist/export/transaction.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("concurrent filesystem aliases share a single export reservation", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const alias = path.join(fixture.root, "alias");
  const parent = path.join(fixture.root, "Parent");
  await fs.promises.mkdir(parent);
  await fs.promises.symlink(parent, alias);
  const outputs = [path.join(parent, "site"), path.join(alias, "site")];
  if (fs.existsSync(path.join(fixture.root, "PARENT"))) {
    outputs.push(path.join(parent, "Site"));
    outputs.push(path.join(fixture.root, "PARENT", "SITE"));
  }
  const results = await Promise.allSettled(
    outputs.map((out) => ExportTransaction.open(out)),
  );
  const winners = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  await Promise.all(winners.map((transaction) => transaction.close()));
  assert.equal(
    winners.length,
    1,
    "case and symlink aliases must not acquire independent locks",
  );
  for (const result of results)
    if (result.status === "rejected")
      assert.match(String(result.reason), /reservation unavailable/);
});

test("distinct output names can reserve concurrently without stealing stale reservations", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const transactions = await Promise.all(
    ["first", "second"].map((name) =>
      ExportTransaction.open(path.join(fixture.root, name)),
    ),
  );
  await assert.rejects(
    ExportTransaction.open(transactions[0]!.output),
    /reservation unavailable/,
  );
  await Promise.all(transactions.map((transaction) => transaction.close()));
});

test("unrelated hashed sibling directories do not control export reservation", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const output = path.join(fixture.root, "site");
  const id = crypto
    .createHash("sha256")
    .update(output)
    .digest("hex")
    .slice(0, 20);
  const reservation = path.join(fixture.root, `.mokly-export-${id}.lock`);
  await fs.promises.mkdir(reservation);
  await fs.promises.writeFile(
    path.join(reservation, ".mokly-export-transaction"),
    JSON.stringify({ schemaVersion: 1, output: "site" }),
  );
  const transaction = await ExportTransaction.open(
    path.join(fixture.root, "Site"),
  );
  await transaction.close();
  assert.ok(fs.existsSync(reservation));
});

test("reservation metadata cannot adopt an unowned or symlinked directory", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const namespace = path.join(fixture.root, RESERVATION_DIRECTORY);
  const unowned = path.join(fixture.root, "unowned");
  await fs.promises.mkdir(unowned);
  await fs.promises.writeFile(path.join(unowned, "keep.txt"), "Keep");
  await fs.promises.symlink(unowned, namespace);
  await assert.rejects(
    ExportTransaction.open(path.join(fixture.root, "site")),
    /unowned|real directory/,
  );
  assert.deepEqual(await fs.promises.readdir(unowned), ["keep.txt"]);
  await fs.promises.unlink(namespace);
  await fs.promises.mkdir(namespace);
  await fs.promises.writeFile(path.join(namespace, "keep.txt"), "Keep");
  await assert.rejects(
    ExportTransaction.open(path.join(fixture.root, "site")),
    /unowned/,
  );
  assert.deepEqual(await fs.promises.readdir(namespace), ["keep.txt"]);
});
