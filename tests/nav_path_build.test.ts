import assert from "node:assert/strict";
import test from "node:test";

import { pathFixture, pageSource } from "./helpers/path_fixture.js";

for (const slug of ["", "has space", "a.b", "a/b", "aux", "CON", 42, null]) {
  test(`build attributes an invalid slug: ${JSON.stringify(slug)}`, async (t) => {
    const fixture = await pathFixture({
      "specs/item.mockup.ts": pageSource(`slug:${JSON.stringify(slug)},`),
    });
    t.after(fixture.remove);
    await assert.rejects(
      fixture.compile(),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes(
          `[invalid-segment] specs/item.mockup.ts export default: slug ${JSON.stringify(slug)} is not a valid path segment; use letters, digits, hyphens and underscores`,
        ),
    );
  });
}

for (const path of [
  "",
  "/absolute",
  "trailing/",
  "a//b",
  "a/../b",
  "C:drive",
  "a/aux",
  42,
]) {
  test(`build attributes an invalid declared path: ${JSON.stringify(path)}`, async (t) => {
    const fixture = await pathFixture({
      "specs/item.mockup.ts": pageSource(`path:${JSON.stringify(path)},`),
    });
    t.after(fixture.remove);
    await assert.rejects(
      fixture.compile(),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes(
          `[invalid-path] specs/item.mockup.ts export default: path ${JSON.stringify(path)} is not a valid path`,
        ),
    );
  });
}

test("a file beside a same-named directory fails unless it declares an index", async (t) => {
  const fixture = await pathFixture({
    "specs/invoice.mockup.ts": pageSource(),
    "specs/invoice/history.mockup.ts": pageSource(),
  });
  t.after(fixture.remove);
  await assert.rejects(
    fixture.compile(),
    /\[duplicate-path\] path invoice is defined twice:/,
  );
  await fixture.write(
    "specs/invoice.mockup.ts",
    pageSource('slug:"index",path:"invoice",'),
  );
  assert.deepEqual(
    (await fixture.compile()).manifest.entries.map((entry) => entry.path),
    ["invoice", "invoice/history"],
  );
});

test("two slug-less definitions collide independently of export naming", async (t) => {
  const source = pageSource();
  const fixture = await pathFixture({
    "specs/item.mockup.ts":
      source.replace("export default", "export const a=") +
      "\n" +
      source
        .replace("import {definePage} from '@mokly/mokly';", "")
        .replace("export default", "export const z="),
  });
  t.after(fixture.remove);
  await assert.rejects(
    fixture.compile(),
    /\[duplicate-path\] path item is defined twice:\n {2}specs\/item.mockup.ts export a\n {2}specs\/item.mockup.ts export z/,
  );
});
