import assert from "node:assert/strict";
import crypto from "node:crypto";

import { files } from "./static_faults.js";

type Json =
  null | boolean | number | string | Json[] | { [name: string]: Json };
function sorted(value: Json): Json {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sorted(value[key]!)]),
    );
  return value;
}
const canonical = (value: Json) =>
  `${JSON.stringify(sorted(value), null, 2)}\n`;
const digest = (bytes: Uint8Array | string) =>
  crypto.createHash("sha256").update(bytes).digest("hex");
const identity = (pairs: Array<[string, string]>) =>
  digest(canonical(pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))));

export async function checkIdentity(
  root: string | ReadonlyMap<string, Buffer>,
  comparisonUrl: string,
  deploymentId: string,
) {
  const inventory = typeof root === "string" ? await files(root) : root;
  const prefix = comparisonUrl.slice(0, -"review.json".length);
  const generation = prefix.split("/").at(-2)!;
  const comparison: Array<[string, string]> = [];
  const deployment: Array<[string, string]> = [];
  for (const [name, bytes] of inventory) {
    const file = name.replaceAll("\\", "/");
    if (file.startsWith(prefix)) {
      const relative = file.slice(prefix.length);
      let value = bytes.toString();
      if (relative.startsWith("entries/")) {
        const detail = JSON.parse(value) as Record<string, Json>;
        assert.equal(detail.generation, generation);
        detail.generation = "0".repeat(64);
        value = canonical(detail);
      }
      comparison.push([
        relative,
        digest(relative.startsWith("entries/") ? value : bytes),
      ]);
    }
    if ([".mokly-export-artifact", "mokly-upload.json"].includes(file))
      continue;
    let value = bytes.toString();
    if (
      file === "mokly-viewer/index.json" ||
      file.startsWith("mokly-viewer/entries/")
    ) {
      const document = JSON.parse(value) as Record<string, Json>;
      document.deploymentId = "0".repeat(64);
      value = canonical(document);
      deployment.push([file, digest(value)]);
    } else deployment.push([file, digest(bytes)]);
  }
  assert.ok(comparison.length > 3);
  assert.equal(identity(comparison), generation);
  assert.equal(identity(deployment), deploymentId);
  const changed = comparison.map(([name, hash]): [string, string] => [
    name,
    name === "review.json" ? "0".repeat(64) : hash,
  ]);
  assert.notEqual(identity(changed), generation);
}
