/** Strict wire projection for generation-pinned Live repository sources. */

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import type {
  InteractiveSourceCapture,
  InteractiveSourceFile,
} from "../../build/interactive_source_capture.js";

/** JSON-safe transient projection sent with a watched runtime. */
export interface InteractiveSourceCaptureMessage {
  readonly files: readonly {
    readonly bytes: string;
    readonly paths: readonly string[];
  }[];
}

/** Encode one accepted source capture as canonical padded base64. */
export function interactiveSourceCaptureMessage(
  capture: InteractiveSourceCapture,
): InteractiveSourceCaptureMessage {
  return {
    files: capture.files.map((file) => ({
      bytes: Buffer.from(
        file.bytes.buffer,
        file.bytes.byteOffset,
        file.bytes.byteLength,
      ).toString("base64"),
      paths: file.paths,
    })),
  };
}

/** Decode and validate an exact capture, reusing an identical retained value. */
export function readInteractiveSourceCapture(
  value: unknown,
  retained?: InteractiveSourceCapture,
): InteractiveSourceCapture | undefined {
  if (!recordWithKeys(value, ["files"]) || !Array.isArray(value["files"]))
    return;
  if (value["files"].length === 0) return;
  const seen = new Set<string>();
  const files: InteractiveSourceFile[] = [];
  let previousFirst: string | undefined;
  for (const candidate of value["files"]) {
    if (
      !recordWithKeys(candidate, ["bytes", "paths"]) ||
      typeof candidate["bytes"] !== "string" ||
      !Array.isArray(candidate["paths"]) ||
      candidate["paths"].length === 0
    )
      return;
    const paths: string[] = [];
    let previousPath: string | undefined;
    for (const path of candidate["paths"]) {
      if (
        typeof path !== "string" ||
        !isSafeRepositoryPath(path) ||
        (previousPath !== undefined && path <= previousPath) ||
        seen.has(path)
      )
        return;
      paths.push(path);
      seen.add(path);
      previousPath = path;
    }
    const first = paths[0]!;
    if (previousFirst !== undefined && first <= previousFirst) return;
    previousFirst = first;
    const bytes = Buffer.from(candidate["bytes"], "base64");
    if (bytes.toString("base64") !== candidate["bytes"]) return;
    files.push(Object.freeze({ bytes, paths: Object.freeze(paths) }));
  }
  if (retained && sameCapture(retained, files)) return retained;
  return Object.freeze({ files: Object.freeze(files) });
}

function sameCapture(
  retained: InteractiveSourceCapture,
  decoded: readonly InteractiveSourceFile[],
): boolean {
  return (
    retained.files.length === decoded.length &&
    retained.files.every((file, index) => {
      const candidate = decoded[index]!;
      return (
        file.paths.length === candidate.paths.length &&
        file.paths.every(
          (path, pathIndex) => path === candidate.paths[pathIndex],
        ) &&
        Buffer.from(
          file.bytes.buffer,
          file.bytes.byteOffset,
          file.bytes.byteLength,
        ).equals(candidate.bytes)
      );
    })
  );
}

function recordWithKeys(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join("\0") === [...keys].sort().join("\0")
  );
}
