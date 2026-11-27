import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import type { SourcePackage } from "../packages/mokly/src/generated/sidecar/SourcePackage.js";
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
  const regular = (file: string) => (contents.has(file) ? file : undefined);
  const files = {
    regular,
    candidate: regular,
    buildTarget: () => true,
    manifest: (file: string) => contents.get(file),
    metadata: () => {},
    read: (file: string) => {
      const text = contents.get(file);
      assert(text !== undefined, file);
      return text;
    },
  };
  for (const entry of cases) {
    assert(jsonObject(entry));
    const {
      name,
      target,
      extensions = [],
      sourcePackages = [],
      expected,
    } = entry;
    assert(typeof name === "string");
    assert(typeof target === "string");
    assert(Array.isArray(extensions) && extensions.every(isString));
    assert(expected === null || typeof expected === "string");
    assert(Array.isArray(sourcePackages) && sourcePackages.every(isPackageMap));
    const sources = new WorkspaceSources(
      root,
      extensions,
      files,
      sourcePackages,
    );
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

function isPackageMap(value: unknown): value is Record<string, SourcePackage> {
  return (
    jsonObject(value) &&
    Object.values(value).every(
      (entry) =>
        entry === false ||
        (jsonObject(entry) && Object.values(entry).every(isString)),
    )
  );
}
