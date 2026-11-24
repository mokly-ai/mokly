import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { jsonObject } from "../packages/mokly/src/sidecar/config-json.js";
import { WorkspaceSources } from "../packages/mokly/src/sidecar/workspace-sources.js";

test("workspace package targets follow the shared source lookup cases", () => {
  const data: unknown = JSON.parse(
    fs.readFileSync(
      new URL("./fixtures/workspace-sources.json", import.meta.url),
      "utf8",
    ),
  );
  assert(
    jsonObject(data) && jsonObject(data.files) && Array.isArray(data.cases),
  );
  const cases: unknown[] = data.cases;
  const root = path.resolve("workspace");
  const contents = new Map(
    Object.entries(data.files).map(([file, text]) => {
      assert(typeof text === "string");
      return [path.resolve(root, file), text];
    }),
  );
  const files = {
    regular: (file: string) => (contents.has(file) ? file : undefined),
    read: (file: string) => {
      const text = contents.get(file);
      assert(text !== undefined, file);
      return text;
    },
  };
  for (const entry of cases) {
    assert(jsonObject(entry));
    const { name, target, extensions = [], expected } = entry;
    assert(typeof name === "string");
    assert(typeof target === "string");
    assert(Array.isArray(extensions) && extensions.every(isString));
    assert(expected === null || typeof expected === "string");
    const sources = new WorkspaceSources(root, extensions, files);
    assert.equal(
      sources.source(path.resolve(root, target)),
      expected === null ? undefined : path.resolve(root, expected),
      name,
    );
  }
});

function isString(value: unknown): value is string {
  return typeof value === "string";
}
