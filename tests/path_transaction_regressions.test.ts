import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { outputLockPath } from "../dist/build/output_lock.js";
import { writeCompilation } from "../dist/build/transaction.js";

import { spyOutputDirectoryLock } from "./helpers/output_directory_lock_spy.js";
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
    assert.ok(!fs.readdirSync(config.generatedDir).includes("billing"));
    assert.ok(
      fs.existsSync(path.join(config.generatedDir, next, "index.html")),
    );
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
  const calls = spyOutputDirectoryLock(t, config);
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
        path.basename(String(args[0])) === "stage" &&
        String(args[1]) === config.generatedDir
      ) {
        failed = true;
        throw new Error("install failed");
      }
      return rename(...args);
    },
  );
  await assert.rejects(writeCompilation(after, config), /install failed/);
  assert.ok(
    calls.some(
      (call) =>
        call.operation === "rename" && call.directory === config.generatedDir,
    ),
  );
  assert.ok(
    calls.some(
      (call) =>
        call.operation === "rm" &&
        path.basename(call.directory).startsWith(".mokly-write-"),
    ),
  );
  assert.equal(fs.existsSync(path.join(config.generatedDir, "account")), false);
  assert.equal(
    fs.readFileSync(
      path.join(config.generatedDir, "billing/invoice/index.html"),
      "utf8",
    ),
    before.outputs.get("billing/invoice/index.html"),
  );
  assert.equal(
    fs.readFileSync(path.join(config.mockupsDir, "keep/notes.txt"), "utf8"),
    "authored",
  );
});

test("whole-tree replacement keeps the catalogue parent and authored siblings", async (t) => {
  const fixture = await pathFixture({
    "specs/account/item.mockup.ts": pageSource(),
    "generated/notes.txt": "Authored",
  });
  t.after(fixture.remove);
  const config = await fixture.config();
  await writeCompilation(await fixture.compile(), config);
  const parent = fs.statSync(config.mockupsDir);
  const sibling = fs.statSync(path.join(config.mockupsDir, "notes.txt"));
  await fixture.write(
    "specs/account/item.mockup.ts",
    pageSource("", "<html><body>Changed</body></html>"),
  );
  await writeCompilation(await fixture.compile(), config);
  assert.equal(fs.statSync(config.mockupsDir).ino, parent.ino);
  assert.equal(
    fs.statSync(path.join(config.mockupsDir, "notes.txt")).ino,
    sibling.ino,
  );
  assert.equal(
    fs.readFileSync(path.join(config.mockupsDir, "notes.txt"), "utf8"),
    "Authored",
  );
  assert.match(
    fs.readFileSync(
      path.join(config.generatedDir, "account/item/index.html"),
      "utf8",
    ),
    /Changed/,
  );
});

test("whole-tree cleanup runs while the output lock remains held", async (t) => {
  const fixture = await pathFixture({ "specs/item.mockup.ts": pageSource() });
  t.after(fixture.remove);
  const config = await fixture.config(),
    compilation = await fixture.compile();
  await fs.promises.mkdir(
    path.join(config.mockupsDir, "mokly-generated/assets/empty"),
    { recursive: true },
  );
  const calls = spyOutputDirectoryLock(t, config);
  await writeCompilation(compilation, config);
  assert.ok(
    calls.some(
      (call) =>
        call.operation === "rename" && call.directory === config.generatedDir,
    ),
  );
  assert.ok(
    calls.some(
      (call) =>
        call.operation === "rm" &&
        path.basename(call.directory).startsWith(".mokly-write-"),
    ),
  );
  assert.equal(
    fs.existsSync(path.join(config.generatedDir, "assets/empty")),
    false,
  );
  assert.ok(fs.existsSync(path.join(config.generatedDir, "item/index.html")));
});
