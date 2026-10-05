import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { writeCompilation } from "../dist/build/transaction.js";

import { pathFixture, pageSource } from "./helpers/path_fixture.js";

test("build keeps a case-folded authored file outside the generated directory", async (t) => {
  const fixture = await pathFixture({
    "specs/account/invoice.mockup.ts": pageSource(),
    "generated/ACCOUNT": "authored resource",
    "generated/account-other.txt": "unrelated",
  });
  t.after(fixture.remove);
  const compilation = await fixture.compile();
  await writeCompilation(compilation, await fixture.config());
  assert.ok(compilation.outputs.has("account/invoice/index.html"));
  assert.equal(
    await fs.readFile(path.join(fixture.root, "generated/ACCOUNT"), "utf8"),
    "authored resource",
  );
});

test("owned documents remain removable after case-only path moves", async (t) => {
  const fixture = await pathFixture({
    "specs/invoice.mockup.ts": pageSource('path:"Account/Invoice",'),
  });
  t.after(fixture.remove);
  await writeCompilation(await fixture.compile(), await fixture.config());
  await fixture.write(
    "specs/invoice.mockup.ts",
    pageSource('path:"account/invoice",'),
  );
  await writeCompilation(await fixture.compile(), await fixture.config());
  await assert.rejects(
    fs.stat(
      path.join(
        fixture.root,
        "generated/mokly-generated/Account/Invoice/index.html",
      ),
    ),
    { code: "ENOENT" },
  );
  assert.ok(
    (
      await fs.stat(
        path.join(
          fixture.root,
          "generated/mokly-generated/account/invoice/index.html",
        ),
      )
    ).isFile(),
  );
});
