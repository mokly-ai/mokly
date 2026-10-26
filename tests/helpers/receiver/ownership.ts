import { decode, object, portable, size } from "./json.js";

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
