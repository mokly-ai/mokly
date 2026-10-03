import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { outputLockPath } from "../dist/build/output_lock.js";
import { writeCompilation } from "../dist/build/transaction.js";

import { pageSource, pathFixture } from "./helpers/path_fixture.js";

for (const next of ["account/invoice", "Billing/Invoice"])
  test(`moves prune every emptied output ancestor: ${next}`, async (t) => {
    const fixture = await pathFixture({
      "specs/item.mockup.ts": pageSource('path:"billing/invoice",'),
    });
    t.after(fixture.remove);
    const config = await fixture.config();
    await writeCompilation(await fixture.compile(), config);
    await fixture.write(
      "specs/item.mockup.ts",
      pageSource(`path:${JSON.stringify(next)},`),
    );
    await writeCompilation(await fixture.compile(), config);
    assert.equal(fs.existsSync(path.join(config.mockupsDir, "billing")), false);
    assert.ok(fs.existsSync(path.join(config.mockupsDir, next, "index.html")));
    assert.ok(fs.existsSync(config.mockupsDir));
  });

test("rollback removes new directories and restores pruned ancestors and files", async (t) => {
  const fixture = await pathFixture({
    "specs/item.mockup.ts": pageSource('path:"billing/invoice",'),
    "generated/keep/notes.txt": "authored",
  });
  t.after(fixture.remove);
  const config = await fixture.config();
  const before = await fixture.compile();
  await writeCompilation(before, config);
  await fixture.write(
    "specs/item.mockup.ts",
    pageSource('path:"account/invoice",'),
  );
  const after = await fixture.compile();
  const rename = fs.promises.rename;
  let failed = false;
  t.mock.method(
    fs.promises,
    "rename",
    async (...args: Parameters<typeof fs.promises.rename>) => {
      assert.ok(
        fs.existsSync(outputLockPath(config.repoRoot)),
        "the lock covers installation and rollback",
      );
      if (
        !failed &&
        String(args[0]).includes("/stage/") &&
        String(args[1]).endsWith("mokly-manifest.json")
      ) {
        failed = true;
        throw new Error("install failed");
      }
      return rename(...args);
    },
  );
  await assert.rejects(writeCompilation(after, config), /install failed/);
  assert.equal(fs.existsSync(path.join(config.mockupsDir, "account")), false);
  assert.equal(
    fs.readFileSync(
      path.join(config.mockupsDir, "billing/invoice/index.html"),
      "utf8",
    ),
    before.outputs.get("billing/invoice/index.html"),
  );
  assert.equal(
    fs.readFileSync(path.join(config.mockupsDir, "keep/notes.txt"), "utf8"),
    "authored",
  );
});

test("unchanged output directories survive replacement without directory watch events", async (t) => {
  const fixture = await pathFixture({
    "specs/account/item.mockup.ts": pageSource(),
  });
  t.after(fixture.remove);
  const config = await fixture.config();
  await writeCompilation(await fixture.compile(), config);
  const removed: string[] = [];
  const rmdir = fs.promises.rmdir;
  t.mock.method(
    fs.promises,
    "rmdir",
    async (...args: Parameters<typeof fs.promises.rmdir>) => {
      removed.push(String(args[0]));
      return rmdir(...args);
    },
  );
  await fixture.write(
    "specs/account/item.mockup.ts",
    pageSource("", "<html><body>Changed</body></html>"),
  );
  await writeCompilation(await fixture.compile(), config);
  const lockDirectory = path.dirname(outputLockPath(config.repoRoot));
  assert.deepEqual(removed, [lockDirectory, path.dirname(lockDirectory)]);
});
