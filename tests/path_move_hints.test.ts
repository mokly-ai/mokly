import assert from "node:assert/strict";
import test from "node:test";

import { pathFixture, pageSource } from "./helpers/path_fixture.js";

test("move hints are authored paths and survive manifest emission without pairing", async (t) => {
  const fixture = await pathFixture({
    "specs/new.mockup.ts": pageSource('movedFrom:"old/page",'),
  });
  t.after(fixture.remove);
  const manifest = (await fixture.compile()).manifest;
  assert.equal(manifest.entries[0]?.movedFrom, "old/page");
  assert.equal("previousPath" in manifest.entries[0]!, false);
});

for (const [fields, message] of [
  ['movedFrom:"new",', "movedFrom new equals the entry's own path"],
  ['movedFrom:"existing",', "movedFrom existing names a current entry"],
] as const)
  test(`move hint authoring rejects ${message}`, async (t) => {
    const fixture = await pathFixture({
      "specs/new.mockup.ts": pageSource(fields),
      "specs/existing.mockup.ts": pageSource(),
    });
    t.after(fixture.remove);
    await assert.rejects(
      fixture.compile(),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes(
          `specs/new.mockup.ts export default: ${message}`,
        ),
    );
  });

test("two entries cannot author the same previous path", async (t) => {
  const fixture = await pathFixture({
    "specs/one.mockup.ts": pageSource('movedFrom:"old/page",'),
    "specs/two.mockup.ts": pageSource('movedFrom:"old/page",'),
  });
  t.after(fixture.remove);
  await assert.rejects(
    fixture.compile(),
    /\[duplicate-moved-from\] movedFrom old\/page is declared twice:\n {2}specs\/one.mockup.ts export default\n {2}specs\/two.mockup.ts export default/,
  );
});
