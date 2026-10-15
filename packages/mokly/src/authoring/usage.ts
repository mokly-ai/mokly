import path from "node:path";

import type { InputOwner } from "../generated/sidecar/InputOwner.js";
import type { InvocationSource } from "../generated/sidecar/InvocationSource.js";

import type { Owner } from "./runtime.js";

export function inputOwner(owner: Owner): InputOwner {
  return owner.kind === "entry"
    ? { kind: "entry" }
    : { kind: "instance", instanceKey: owner.instanceKey! };
}

/** Invocation metadata is secondary and must never expose an absolute path. */
export function invocationSource(
  value: unknown,
  root: string,
): InvocationSource | undefined {
  if (value === undefined) return;
  if (!value || typeof value !== "object")
    throw new Error("invalid invocation source");
  const { fileName, lineNumber, columnNumber } = value as Record<
    string,
    unknown
  >;
  if (
    typeof fileName !== "string" ||
    !Number.isSafeInteger(lineNumber) ||
    !Number.isSafeInteger(columnNumber) ||
    Number(lineNumber) < 1 ||
    Number(columnNumber) < 1
  )
    throw new Error("invalid invocation source");
  const relative = path
    .relative(root, path.resolve(root, fileName))
    .split(path.sep)
    .join("/");
  if (
    !relative ||
    relative
      .split("/")
      .some((segment) => !segment || segment === "." || segment === "..") ||
    relative.includes("\\") ||
    relative.includes(":") ||
    relative.includes("\0")
  )
    throw new Error("invocation source is outside sourceRoot");
  return {
    path: relative,
    line: Number(lineNumber),
    column: Number(columnNumber),
  };
}
