import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { isAuthoringSource } from "../dist/build/source_inventory.js";
import { discoverEntries } from "../dist/config/entry_discovery.js";
import { isEntryGlobCandidate } from "../dist/server/watch_paths.js";

import { pageSource, pathFixture } from "./helpers/path_fixture.js";

for (const exclude of ["drafts", "drafts/**"]) {
  test(`folder exclusions match files only: ${exclude}`, async (t) => {
    const fixture = await pathFixture(
      {
        "generated/specs/_folder.json": JSON.stringify({ exclude: [exclude] }),
        "generated/specs/page.mockup.ts": pageSource(),
        "generated/specs/drafts/secret.mockup.ts": pageSource(),
      },
      '{mockupsDir:"generated", roots:[{dir:"generated/specs"}]}',
    );
    t.after(fixture.remove);
    const config = await fixture.config();
    const secret = path.join(
      fixture.root,
      "generated/specs/drafts/secret.mockup.ts",
    );
    assert.equal(config.entryModules?.includes(secret), exclude === "drafts");
    assert.equal(isEntryGlobCandidate(secret, config), exclude === "drafts");
    assert.ok(isAuthoringSource(secret, config));
    assert.ok(
      (await fixture.compile()).manifest.sourceFiles.includes(
        "generated/specs/drafts/secret.mockup.ts",
      ),
    );
    assert.ok(
      isAuthoringSource(
        path.join(fixture.root, "generated/_FOLDER.JSON"),
        config,
      ),
    );
  });
}

test("folder records cannot belong to overlapping roots with disjoint module globs", async (t) => {
  const fixture = await pathFixture(
    {
      "src/feature/page.mockup.ts": pageSource(),
      "src/feature/other.other.ts": pageSource(),
      "src/feature/_folder.json": '{"title":"Feature"}',
    },
    '{mockupsDir:"generated",roots:[{dir:"src",files:["**/*.mockup.ts"]},{dir:"src/feature",files:["*.other.ts"]}]}',
  );
  t.after(fixture.remove);
  await assert.rejects(fixture.config(), {
    code: "config-invalid",
    message:
      "[mokly/config-invalid] file src/feature/_folder.json is matched by roots[0] and roots[1]",
  });
});

for (const operation of ["lstatSync", "readFileSync"] as const) {
  for (const code of ["ENOENT", "EACCES"]) {
    test(`folder record ${operation} ${code} preserves directory context`, async (t) => {
      const fixture = await pathFixture({
        "specs/account/page.mockup.ts": pageSource(),
      });
      t.after(fixture.remove);
      const config = await fixture.config();
      const filename = path.join(fixture.root, "specs/account/_folder.json");
      await fixture.write("specs/account/_folder.json", "{}");
      const original = fs[operation];
      const failure = Object.assign(new Error(`failed ${filename}`), { code });
      t.mock.method(fs, operation, (...args: unknown[]) => {
        if (args[0] === filename) throw failure;
        return Reflect.apply(original, fs, args);
      });
      if (code === "ENOENT")
        assert.deepEqual(discoverEntries(config).entryModules, [
          path.join(fixture.root, "specs/account/page.mockup.ts"),
        ]);
      else
        assert.throws(() => discoverEntries(config), {
          code: "config-invalid",
          message:
            "[mokly/config-invalid] cannot discover entry path specs/account/_folder.json: EACCES",
          cause: failure,
        });
    });
  }
}

for (const value of ["null", "[]", '"record"']) {
  test(`folder records require a JSON object: ${value}`, async (t) => {
    const fixture = await pathFixture({
      "specs/account/page.mockup.ts": pageSource(),
      "specs/account/_folder.json": value,
    });
    t.after(fixture.remove);
    await assert.rejects(
      fixture.config(),
      /\[invalid-folder\] specs\/account\/_folder.json: must be a JSON object$/,
    );
  });
}

test("folder records attribute invalid directory grammar to its directory name", async (t) => {
  const fixture = await pathFixture({
    "specs/My Dir/page.mockup.ts": pageSource(),
    "specs/My Dir/_folder.json": "{}",
  });
  t.after(fixture.remove);
  await assert.rejects(
    fixture.config(),
    /\[invalid-segment\] specs\/My Dir\/_folder.json: directory name "My Dir" is not a valid path segment; use letters, digits, hyphens and underscores$/,
  );
});

test("a root equal to mockupsDir names the root field", async (t) => {
  const fixture = await pathFixture(
    { "generated/page.mockup.ts": pageSource() },
    '{mockupsDir:"generated", roots:[{dir:"generated"}]}',
  );
  t.after(fixture.remove);
  await assert.rejects(
    fixture.config(),
    /roots\[0\].dir must not equal mockupsDir$/,
  );
});

test("excluded root matches still have exactly one root owner", async (t) => {
  const fixture = await pathFixture(
    {
      "specs/page.mockup.ts": pageSource(),
      "specs/_folder.json": '{"exclude":["nested/**"]}',
      "specs/nested/item.mockup.ts": pageSource(),
    },
    '{mockupsDir:"generated",roots:[{dir:"specs"},{dir:"specs/nested"}]}',
  );
  t.after(fixture.remove);
  await assert.rejects(
    fixture.config(),
    /file specs\/nested\/item.mockup.ts is matched by roots\[0\] and roots\[1\]/,
  );
});
