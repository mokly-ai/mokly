import assert from "node:assert/strict";
import test from "node:test";

import { ComponentMaterialReader } from "../dist/review/component_resources.js";

for (const batched of [false, true])
  test(`required reads retain the underlying error after a negative optional read, batched=${batched}`, async () => {
    const failure = new Error(
      batched
        ? "required batch rejected missing.svg"
        : "required read rejected missing.svg",
    );
    const reader = new ComponentMaterialReader({
      read: async () => {
        throw failure;
      },
      readIfExists: async () => undefined,
      ...(batched
        ? {
            readMany: async () => {
              throw failure;
            },
          }
        : {}),
    });
    assert.equal(
      (await reader.optionalTexts(["missing.svg"])).get("missing.svg"),
      undefined,
    );
    await assert.rejects(
      batched ? reader.prefetch(["missing.svg"]) : reader.read("missing.svg"),
      (error) => error === failure,
    );
  });

for (const optional of [false, true])
  test(`successful proofs reuse transitive reads and complete discovery, optional=${optional}`, async () => {
    const files = new Map([
      ["x.css", '@import "nested.css";'],
      ["nested.css", '@import "x.css";.x{background:url("y.svg")}'],
      ["y.svg", ""],
    ]);
    const reads: string[] = [];
    const read = async (route: string) => {
      reads.push(route);
      assert.ok(files.has(route));
      return Buffer.from(files.get(route)!);
    };
    const reader = new ComponentMaterialReader({
      read,
      ...(optional ? { readIfExists: read } : {}),
    });
    const expected = new Set(["x.css", "nested.css", "y.svg"]);
    assert.deepEqual(
      await reader.resourcesIfPresent("view.html", "", undefined, ["x.css"]),
      expected,
    );
    assert.deepEqual(
      await reader.resources("view.html", "", undefined, ["x.css"]),
      expected,
    );
    assert.deepEqual(
      await reader.resourcesIfPresent("second.html", "", undefined, ["x.css"]),
      expected,
    );
    assert.deepEqual(reads.sort(), [...files.keys()].sort());
  });

for (const optional of [false, true])
  test(`failed proofs cannot cache a truncated closure, optional=${optional}`, async () => {
    const failure = new Error("required reader rejected y.svg");
    const reader = new ComponentMaterialReader({
      read: async (route) => {
        if (route === "x.css")
          return Buffer.from('.x{background:url("y.svg")}');
        throw failure;
      },
      ...(optional
        ? {
            readIfExists: async (route: string) =>
              route === "x.css"
                ? Buffer.from('.x{background:url("y.svg")}')
                : undefined,
          }
        : {}),
    });
    assert.equal(
      await reader.resourcesIfPresent("view.html", "", undefined, ["x.css"]),
      undefined,
    );
    await assert.rejects(
      reader.resources("view.html", "", undefined, ["x.css"]),
      (error) => error === failure,
    );
  });

test("required-only batch readers keep their bulk-read capability during proof", async () => {
  const reader = new ComponentMaterialReader({
    read: async () =>
      assert.fail("single-file reads must not replace the supported batch"),
    readMany: async (routes) =>
      new Map(routes.map((route) => [route, Buffer.from("")])),
  });
  assert.deepEqual(
    await reader.resourcesIfPresent("view.html", "", undefined, ["x.css"]),
    new Set(["x.css"]),
  );
});
