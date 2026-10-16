import crypto from "node:crypto";

import { decode, object, portable, size } from "./json.js";
import { upload } from "./upload.js";

export interface Owned {
  path: string;
  sha256: string;
  size: number;
}
const marker = ".mokly-export-artifact";
export function ownership(bytes: Uint8Array): Owned[] {
  const root = object(decode(bytes));
  if (!("schemaVersion" in root)) throw new Error("invalid");
  if (root.schemaVersion !== 3) throw new Error("unsupported-version");
  if (!Array.isArray(root.files)) throw new Error("invalid");
  const names = new Set([marker]);
  return root.files.map((value: unknown) => {
    const item = object(value);
    const { path, sha256, size: length } = item;
    if (
      typeof path !== "string" ||
      typeof sha256 !== "string" ||
      typeof length !== "number"
    )
      throw new Error("invalid");
    if (size(path) > 1024 || (Number.isInteger(length) && length > 67_108_864))
      throw new Error("too-large");
    if (
      !Number.isInteger(length) ||
      length < 0 ||
      !portable(path) ||
      !/^[0-9a-f]{64}$/u.test(sha256)
    )
      throw new Error("invalid");
    const folded = path.toLowerCase();
    if (
      [...names].some(
        (name) =>
          name === folded ||
          name.startsWith(`${folded}/`) ||
          folded.startsWith(`${name}/`),
      )
    )
      throw new Error("invalid");
    names.add(folded);
    return { path, sha256, size: length };
  });
}
export const digest = (bytes: Uint8Array) =>
  crypto.createHash("sha256").update(bytes).digest("hex");
export function verifyInventory(entries: Array<[string, Uint8Array]>): Owned[] {
  if (
    entries.length > 20_000 ||
    entries.some(
      ([name, bytes]) => size(name) > 1024 || bytes.length > 67_108_864,
    )
  )
    throw new Error("too-large");
  const map = new Map(entries);
  if (map.size !== entries.length || !map.has(marker))
    throw new Error("invalid");
  const owned = ownership(map.get(marker)!);
  if (
    map.size !== owned.length + 1 ||
    !["index.html", "404.html", "mokly-upload.json"].every((file) =>
      map.has(file),
    )
  )
    throw new Error("invalid");
  for (const entry of owned) {
    const bytes = map.get(entry.path);
    if (!bytes || bytes.length !== entry.size || digest(bytes) !== entry.sha256)
      throw new Error("invalid");
  }
  const metadata = upload(map.get("mokly-upload.json")!);
  if (
    metadata.comparisonPath === null &&
    [...map.keys()].some((name) => name.startsWith("mokly-viewer/diffs/"))
  )
    throw new Error("invalid");
  return owned;
}
