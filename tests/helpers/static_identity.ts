import assert from "node:assert/strict";
import crypto from "node:crypto";

import { readCatalogueIndex } from "../../packages/viewer/src/catalogue/index_reader.js";
import type {
  CatalogueReadModel,
  CatalogueRecord,
} from "../../packages/viewer/src/catalogue/types.js";

import { files } from "./static_faults.js";

type Json =
  null | boolean | number | string | Json[] | { [name: string]: Json };
function utf16Compare(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index++) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference) return difference;
  }
  return left.length - right.length;
}
function sorted(value: Json): Json {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort(utf16Compare)
        .map((key) => [key, sorted(value[key]!)]),
    );
  return value;
}
const canonical = (value: Json) =>
  `${JSON.stringify(sorted(value), null, 2)}\n`;
const digest = (bytes: Uint8Array | string) =>
  crypto.createHash("sha256").update(bytes).digest("hex");
const identity = (pairs: Array<[string, string]>) =>
  digest(canonical(pairs.sort(([a], [b]) => utf16Compare(a, b))));

function detailId(bytes: Buffer, expected: string) {
  const detail = JSON.parse(bytes.toString()) as Record<string, Json>;
  const actual = detail.detailId;
  assert.equal(typeof actual, "string");
  const preimage: Record<string, Json> = {
    ...detail,
    detailId: "0".repeat(64),
  };
  if (Object.hasOwn(detail, "revision")) preimage.revision = 0;
  assert.equal(digest(canonical(preimage)), actual);
  assert.equal(actual, expected);
}

function records(index: CatalogueReadModel): Map<string, CatalogueRecord> {
  return new Map(
    [
      ...index.screens,
      ...index.components,
      ...index.pages,
      ...index.documents,
      ...index.useCases,
    ].map((entry) => [entry.path, entry]),
  );
}

function checkDetailIds(
  inventory: ReadonlyMap<string, Buffer>,
  index: CatalogueReadModel,
  comparisonUrl: string,
) {
  const current = records(index);
  const removed = new Map(
    index.removedEntries.map((entry) => [entry.entry.path, entry.entry]),
  );
  const seenCurrent = new Set<string>();
  const seenRemoved = new Set<string>();
  for (const [name, bytes] of inventory) {
    const file = name.replaceAll("\\", "/");
    let expected: string | undefined;
    if (file.startsWith("mokly-viewer/entries/") && file.endsWith(".json")) {
      const path = file.slice("mokly-viewer/entries/".length, -".json".length);
      expected = current.get(path)?.detailId;
      if (expected !== undefined) seenCurrent.add(path);
    } else if (
      file.startsWith(`${comparisonUrl}entries/`) &&
      file.endsWith(".json")
    ) {
      const path = file.slice(
        `${comparisonUrl}entries/`.length,
        -".json".length,
      );
      expected = removed.get(path)?.detailId;
      if (expected !== undefined) seenRemoved.add(path);
    }
    if (expected !== undefined) detailId(bytes, expected);
  }
  for (const path of current.keys()) assert.ok(seenCurrent.has(path), path);
  for (const path of removed.keys()) assert.ok(seenRemoved.has(path), path);
}

export async function checkIdentity(
  root: string | ReadonlyMap<string, Buffer>,
  comparisonUrl: string,
  deploymentId: string,
) {
  const inventory = typeof root === "string" ? await files(root) : root;
  const prefix = comparisonUrl;
  const generation = prefix.split("/").at(-2)!;
  const comparison: Array<[string, string]> = [];
  const deployment: Array<[string, string]> = [];
  let index: CatalogueReadModel | undefined;
  for (const [name, bytes] of inventory) {
    const file = name.replaceAll("\\", "/");
    if (file.startsWith(prefix)) {
      const relative = file.slice(prefix.length);
      comparison.push([relative, digest(bytes)]);
    }
    if ([".mokly-export-artifact", "mokly-upload.json"].includes(file))
      continue;
    if (file === "mokly-viewer/deployment.json") continue;
    let value = bytes.toString();
    if (file === "mokly-viewer/index.json") {
      index = readCatalogueIndex(JSON.parse(value));
      const document = JSON.parse(value) as Record<string, Json>;
      document.deploymentId = "0".repeat(64);
      value = canonical(document);
      deployment.push([file, digest(value)]);
    } else deployment.push([file, digest(bytes)]);
  }
  assert.ok(comparison.length > 3);
  assert.equal(identity(comparison), generation);
  assert.equal(identity(deployment), deploymentId);
  assert.ok(index);
  checkDetailIds(inventory, index, prefix);
  const changed = comparison.map(([name, hash], position): [string, string] => [
    name,
    position === 0 ? "0".repeat(64) : hash,
  ]);
  assert.notEqual(identity(changed), generation);
}
