/** Strict wire projection for generation-pinned Live sources and stylesheets. */

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import type {
  InteractiveSourceCapture,
  InteractiveSourceFile,
} from "../../build/interactive_source_capture.js";
import {
  INTERACTIVE_SOURCE_ATTRIBUTE_KEY_LIMIT,
  INTERACTIVE_SOURCE_ATTRIBUTE_LIMIT,
  INTERACTIVE_SOURCE_ATTRIBUTE_VALUE_LIMIT,
  INTERACTIVE_SOURCE_RESOLUTION_LIMIT,
  installedInteractiveSourceImporter,
  interactiveSourceResolutionKey,
  isInteractiveSourceResolutionKind,
  repositoryInteractiveSourceImporter,
  type InteractiveSourceImportAttribute,
  type InteractiveSourceImporter,
  type InteractiveSourceResolution,
  validInteractiveSourceResolutionRequest,
  validInteractiveSourceResolutionSet,
  validInteractiveSourceText,
} from "../../build/interactive_source_resolution.js";

/** JSON-safe transient projection sent with a watched runtime. */
export interface InteractiveSourceCaptureMessage {
  readonly files: readonly {
    readonly bytes: string;
    readonly paths: readonly string[];
  }[];
  readonly resolutions: readonly InteractiveSourceResolution[];
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
    resolutions: capture.resolutions,
  };
}

/** Decode and validate an exact capture, reusing an identical retained value. */
export function readInteractiveSourceCapture(
  value: unknown,
  retained?: InteractiveSourceCapture,
): InteractiveSourceCapture | undefined {
  if (
    !recordWithKeys(value, ["files", "resolutions"]) ||
    !Array.isArray(value["files"]) ||
    !Array.isArray(value["resolutions"])
  )
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
  const resolutions = readResolutions(value["resolutions"], seen);
  if (!resolutions) return;
  if (retained && sameCapture(retained, files, resolutions)) return retained;
  return Object.freeze({
    files: Object.freeze(files),
    resolutions: Object.freeze(resolutions),
  });
}

function sameCapture(
  retained: InteractiveSourceCapture,
  decoded: readonly InteractiveSourceFile[],
  resolutions: readonly InteractiveSourceResolution[],
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
    }) &&
    retained.resolutions.length === resolutions.length &&
    retained.resolutions.every((resolution, index) => {
      const candidate = resolutions[index]!;
      return (
        interactiveSourceResolutionKey(resolution) ===
          interactiveSourceResolutionKey(candidate) &&
        resolution.target === candidate.target
      );
    })
  );
}

function readResolutions(
  values: readonly unknown[],
  capturedPaths: ReadonlySet<string>,
): InteractiveSourceResolution[] | undefined {
  if (values.length > INTERACTIVE_SOURCE_RESOLUTION_LIMIT) return;
  const resolutions: InteractiveSourceResolution[] = [];
  let previousKey: string | undefined;
  for (const value of values) {
    const resolution = readResolution(value, capturedPaths);
    if (!resolution) return;
    const key = interactiveSourceResolutionKey(resolution);
    if (previousKey !== undefined && key <= previousKey) return;
    previousKey = key;
    resolutions.push(resolution);
  }
  return validInteractiveSourceResolutionSet(resolutions)
    ? resolutions
    : undefined;
}

function readResolution(
  value: unknown,
  capturedPaths: ReadonlySet<string>,
): InteractiveSourceResolution | undefined {
  if (
    !recordWithKeys(value, [
      "attributes",
      "importer",
      "kind",
      "specifier",
      "target",
    ]) ||
    !Array.isArray(value["attributes"]) ||
    value["attributes"].length > INTERACTIVE_SOURCE_ATTRIBUTE_LIMIT ||
    typeof value["kind"] !== "string" ||
    !isInteractiveSourceResolutionKind(value["kind"]) ||
    typeof value["specifier"] !== "string" ||
    typeof value["target"] !== "string" ||
    !isSafeRepositoryPath(value["target"]) ||
    !capturedPaths.has(value["target"])
  )
    return;
  const importer = readImporter(value["importer"]);
  const attributes = readAttributes(value["attributes"]);
  if (!importer || !attributes) return;
  if (importer.type === "installed" && !value["target"].endsWith(".css"))
    return;
  const resolution = Object.freeze({
    attributes: Object.freeze(attributes),
    importer,
    kind: value["kind"],
    specifier: value["specifier"],
    target: value["target"],
  });
  return validInteractiveSourceResolutionRequest(resolution)
    ? resolution
    : undefined;
}

function readImporter(value: unknown): InteractiveSourceImporter | undefined {
  if (recordWithKeys(value, ["type"]) && value["type"] === "entry")
    return Object.freeze({ type: "entry" });
  if (
    !recordWithKeys(value, ["path", "type"]) ||
    typeof value["path"] !== "string"
  )
    return;
  if (value["type"] === "repository")
    return repositoryInteractiveSourceImporter(value["path"]);
  if (value["type"] === "installed")
    return installedInteractiveSourceImporter(value["path"]);
  return;
}

function readAttributes(
  values: readonly unknown[],
): InteractiveSourceImportAttribute[] | undefined {
  const attributes: InteractiveSourceImportAttribute[] = [];
  let previousKey: string | undefined;
  for (const value of values) {
    if (
      !recordWithKeys(value, ["key", "value"]) ||
      typeof value["key"] !== "string" ||
      typeof value["value"] !== "string" ||
      !validInteractiveSourceText(
        value["key"],
        INTERACTIVE_SOURCE_ATTRIBUTE_KEY_LIMIT,
      ) ||
      !validInteractiveSourceText(
        value["value"],
        INTERACTIVE_SOURCE_ATTRIBUTE_VALUE_LIMIT,
        true,
      ) ||
      (previousKey !== undefined && value["key"] <= previousKey)
    )
      return;
    previousKey = value["key"];
    attributes.push(
      Object.freeze({ key: value["key"], value: value["value"] }),
    );
  }
  return attributes;
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
