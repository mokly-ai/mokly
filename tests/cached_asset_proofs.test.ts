import assert from "node:assert/strict";
import test from "node:test";

import { cachedReviewAssets } from "../dist/review/cached_assets.js";

for (const batch of [false, true])
  test(`required cached reads preserve the reader error after optional absence, batch=${batch}`, async () => {
    const failure = new Error("underlying required read: missing fixture.html");
    const calls: string[] = [];
    const reader = cachedReviewAssets({
      read: async (route) => {
        calls.push(`read:${route}`);
        throw failure;
      },
      readMany: async (routes) => {
        calls.push(`readMany:${routes.join(",")}`);
        throw failure;
      },
      readIfExists: async () => undefined,
    });
    assert.equal(await reader.readIfExists!("fixture.html"), undefined);
    await assert.rejects(
      batch ? reader.readMany!(["fixture.html"]) : reader.read("fixture.html"),
      (error: unknown) => error === failure,
    );
    assert.deepEqual(calls, [`${batch ? "readMany" : "read"}:fixture.html`]);
  });

test("a failed cached batch cannot poison an existing resource needed later", async () => {
  const bytes = Buffer.from("existing asset");
  const calls: string[] = [];
  const reader = cachedReviewAssets({
    read: async (route) => {
      calls.push(route);
      assert.equal(route, "asset.svg");
      return bytes;
    },
    readMany: async () => {
      throw new Error("batch missing unused.svg");
    },
  });
  await assert.rejects(
    reader.readMany!(["unused.svg", "asset.svg"]),
    /batch missing unused.svg/,
  );
  assert.equal(await reader.read("asset.svg"), bytes);
  assert.deepEqual(calls, ["asset.svg"]);
});

test("successful optional cached bytes still transfer without a required read", async () => {
  const bytes = Buffer.from("retained asset");
  let probes = 0;
  const reader = cachedReviewAssets({
    read: async () => assert.fail("successful optional bytes must be reused"),
    readMany: async () =>
      assert.fail("successful optional bytes must be reused"),
    readManyIfExists: async (routes) => {
      probes++;
      return new Map(routes.map((route) => [route, bytes]));
    },
  });
  await reader.readManyIfExists!(["asset.svg"]);
  assert.equal(await reader.read("asset.svg"), bytes);
  assert.equal((await reader.readMany!(["asset.svg"])).get("asset.svg"), bytes);
  assert.equal(probes, 1);
});
