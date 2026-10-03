import assert from "node:assert/strict";
import test from "node:test";

import { cliErrorPresentation } from "../dist/cli/errors.js";
import { MoklyError } from "../dist/errors.js";

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

test("genuine consumer evaluation failures remain bundle errors", async (t) => {
  const fixture = await pathFixture({
    "specs/broken.mockup.ts":
      'throw new Error("consumer exploded"); export {};',
  });
  t.after(fixture.remove);
  await assert.rejects(fixture.compile(), (error: unknown) => {
    assert.ok(error instanceof MoklyError);
    assert.equal(error.code, "build-invalid");
    assert.equal(
      error.message,
      "[mokly/build-invalid] could not bundle consumer modules: consumer exploded",
    );
    return true;
  });
});

test("consumer export errors keep their attributed CLI presentation", async (t) => {
  const fixture = await pathFixture({
    "specs/empty.mockup.ts": "export const helpers = [];",
  });
  t.after(fixture.remove);
  await assert.rejects(fixture.compile(), (error: unknown) => {
    assert.ok(error instanceof MoklyError);
    assert.equal(
      error.message,
      "[mokly/build-invalid] [empty-module] specs/empty.mockup.ts exports no Mokly definition",
    );
    assert.equal(cliErrorPresentation(error).code, "build-invalid");
    assert.equal(
      cliErrorPresentation(error).detail,
      "[empty-module] specs/empty.mockup.ts exports no Mokly definition",
    );
    assert.equal(error.message.match(/\[mokly\/build-invalid\]/g)?.length, 1);
    assert.doesNotMatch(error.message, /could not bundle consumer modules/);
    return true;
  });
});
