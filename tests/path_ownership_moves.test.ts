import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";

import { pathFixture, pageSource } from "./helpers/path_fixture.js";

for (const declared of [false, true])
  test(`moving an exporting module and its helper replaces the generated tree: declared path ${declared}`, async (t) => {
    const fixture = await pathFixture({
      "specs/account/page.ts": pageSource(declared ? 'path:"account",' : ""),
      "specs/account/index.mockup.ts": "export {default} from './page';",
    });
    t.after(fixture.remove);
    const before = await fixture.config();
    await writeCompilation(await compileCatalogue(before), before);
    await fs.rename(
      path.join(fixture.root, "specs/account"),
      path.join(fixture.root, "specs/billing"),
    );
    const after = await fixture.config();
    await writeCompilation(await compileCatalogue(after), after);
    const entryPath = declared ? "account" : "billing";
    assert.match(
      await fs.readFile(
        path.join(
          fixture.root,
          `generated/mokly-generated/${entryPath}/index.html`,
        ),
        "utf8",
      ),
      /Page/,
    );
    if (!declared)
      await assert.rejects(
        fs.stat(
          path.join(
            fixture.root,
            "generated/mokly-generated/account/index.html",
          ),
        ),
        { code: "ENOENT" },
      );
  });
