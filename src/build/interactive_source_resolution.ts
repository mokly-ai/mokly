/** Canonical request identities for accepted source and stylesheet resolutions. */

import type {
  ImportKind,
  OnResolveArgs,
  OnResolveResult,
  PluginBuild,
} from "esbuild";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import {
  CONSUMER_ENTRY_NAMESPACE,
  INTERACTIVE_CONSUMER_NAMESPACE,
} from "./consumer_entry.js";

/** Maximum recorded resolutions in one accepted generation. */
export const INTERACTIVE_SOURCE_RESOLUTION_LIMIT = 16_384;
/** Maximum UTF-8 bytes in one recorded import specifier. */
const INTERACTIVE_SOURCE_SPECIFIER_LIMIT = 2_048;
/** Maximum import attributes attached to one resolution request. */
export const INTERACTIVE_SOURCE_ATTRIBUTE_LIMIT = 16;
/** Maximum UTF-8 bytes in one import-attribute key. */
export const INTERACTIVE_SOURCE_ATTRIBUTE_KEY_LIMIT = 256;
/** Maximum UTF-8 bytes in one import-attribute value. */
export const INTERACTIVE_SOURCE_ATTRIBUTE_VALUE_LIMIT = 2_048;
/** Maximum combined attribute UTF-8 bytes in one request. */
const INTERACTIVE_SOURCE_ATTRIBUTES_SIZE_LIMIT = 4_096;
/** Maximum variable UTF-8 string bytes across one resolution record. */
const INTERACTIVE_SOURCE_RESOLUTIONS_SIZE_LIMIT = 8 * 1024 * 1024;

/** Every esbuild request kind admitted by the capture wire format. */
const INTERACTIVE_SOURCE_RESOLUTION_KINDS = [
  "entry-point",
  "import-statement",
  "require-call",
  "dynamic-import",
  "require-resolve",
  "import-rule",
  "composes-from",
  "url-token",
] as const satisfies readonly ImportKind[];

/** Stable identity for the Node and browser projections of one importer. */
export type InteractiveSourceImporter =
  | { readonly type: "entry" }
  | { readonly path: string; readonly type: "repository" }
  | { readonly path: string; readonly type: "installed" };

/** One sorted import attribute that can participate in resolution. */
export interface InteractiveSourceImportAttribute {
  readonly key: string;
  readonly value: string;
}

/** Accepted request identity and its captured target. */
export interface InteractiveSourceResolution {
  readonly attributes: readonly InteractiveSourceImportAttribute[];
  readonly importer: InteractiveSourceImporter;
  readonly kind: ImportKind;
  readonly specifier: string;
  readonly target: string;
}

/** Request fields used to find an accepted resolution before touching disk. */
export type InteractiveSourceResolutionRequest = Omit<
  InteractiveSourceResolution,
  "target"
>;

/** Normalize both consumer-entry projections to one stable identity. */
export function virtualInteractiveSourceImporter(
  arguments_: OnResolveArgs,
): InteractiveSourceImporter | undefined {
  if (
    arguments_.namespace !== CONSUMER_ENTRY_NAMESPACE &&
    arguments_.namespace !== INTERACTIVE_CONSUMER_NAMESPACE
  )
    return;
  return Object.freeze({ type: "entry" });
}

/** Normalize an owned module to its repository-relative logical identity. */
export function repositoryInteractiveSourceImporter(
  path: string,
): InteractiveSourceImporter | undefined {
  if (!isSafeRepositoryPath(path)) return;
  return Object.freeze({ path, type: "repository" });
}

/** Validate the confined logical identity of an installed source importer. */
export function installedInteractiveSourceImporter(
  path: string,
): InteractiveSourceImporter | undefined {
  if (!isSafeRepositoryPath(path)) return;
  return Object.freeze({ path, type: "installed" });
}

/** Resolve through the remaining graph plugins without recursing into capture. */
export async function resolveInteractiveSourceRequest(
  pluginBuild: PluginBuild,
  arguments_: OnResolveArgs,
  skipResolution: object,
): Promise<OnResolveResult> {
  return pluginBuild.resolve(arguments_.path, {
    importer: arguments_.importer,
    kind: arguments_.kind,
    namespace: arguments_.namespace,
    pluginData: skipResolution,
    resolveDir: arguments_.resolveDir,
    with: arguments_.with,
  });
}

/** Capture esbuild's exact request identity with sorted attributes. */
export function interactiveSourceResolutionRequest(
  arguments_: OnResolveArgs,
  importer: InteractiveSourceImporter,
): InteractiveSourceResolutionRequest {
  return Object.freeze({
    attributes: Object.freeze(
      Object.entries(arguments_.with)
        .sort(([left], [right]) => compareText(left, right))
        .map(([key, value]) => Object.freeze({ key, value })),
    ),
    importer,
    kind: arguments_.kind,
    specifier: arguments_.path,
  });
}

/** Canonical sortable identity for one recorded request. */
export function interactiveSourceResolutionKey(
  request: InteractiveSourceResolutionRequest,
): string {
  return JSON.stringify([
    request.importer.type === "entry"
      ? ["entry"]
      : [request.importer.type, request.importer.path],
    request.specifier,
    request.kind,
    request.attributes.map(({ key, value }) => [key, value]),
  ]);
}

/** Count bounded variable string data retained by one record. */
function interactiveSourceResolutionBytes(
  resolution: InteractiveSourceResolution,
): number {
  return (
    utf8Bytes(resolution.specifier) +
    utf8Bytes(resolution.target) +
    utf8Bytes(resolution.kind) +
    utf8Bytes(resolution.importer.type) +
    (resolution.importer.type !== "entry"
      ? utf8Bytes(resolution.importer.path)
      : 0) +
    resolution.attributes.reduce(
      (total, attribute) =>
        total + utf8Bytes(attribute.key) + utf8Bytes(attribute.value),
      0,
    )
  );
}

/** Return whether one normalized request satisfies every wire field bound. */
export function validInteractiveSourceResolutionRequest(
  request: InteractiveSourceResolutionRequest,
): boolean {
  if (
    !validInteractiveSourceText(
      request.specifier,
      INTERACTIVE_SOURCE_SPECIFIER_LIMIT,
    ) ||
    request.attributes.length > INTERACTIVE_SOURCE_ATTRIBUTE_LIMIT
  )
    return false;
  let attributeBytes = 0;
  for (const attribute of request.attributes) {
    if (
      !validInteractiveSourceText(
        attribute.key,
        INTERACTIVE_SOURCE_ATTRIBUTE_KEY_LIMIT,
      ) ||
      !validInteractiveSourceText(
        attribute.value,
        INTERACTIVE_SOURCE_ATTRIBUTE_VALUE_LIMIT,
        true,
      )
    )
      return false;
    attributeBytes += utf8Bytes(attribute.key) + utf8Bytes(attribute.value);
  }
  return attributeBytes <= INTERACTIVE_SOURCE_ATTRIBUTES_SIZE_LIMIT;
}

/** Return whether one complete record stays inside aggregate capture bounds. */
export function validInteractiveSourceResolutionSet(
  resolutions: readonly InteractiveSourceResolution[],
): boolean {
  return (
    resolutions.length <= INTERACTIVE_SOURCE_RESOLUTION_LIMIT &&
    resolutions.reduce(
      (total, resolution) =>
        total + interactiveSourceResolutionBytes(resolution),
      0,
    ) <= INTERACTIVE_SOURCE_RESOLUTIONS_SIZE_LIMIT
  );
}

/** Return whether a bounded wire string is nonempty and contains no NUL. */
export function validInteractiveSourceText(
  value: string,
  byteLimit: number,
  allowEmpty = false,
): boolean {
  return (
    (allowEmpty || value.length > 0) &&
    !value.includes("\0") &&
    utf8Bytes(value) <= byteLimit
  );
}

/** Return whether a resolution kind belongs to the supported esbuild set. */
export function isInteractiveSourceResolutionKind(
  value: string,
): value is ImportKind {
  return (INTERACTIVE_SOURCE_RESOLUTION_KINDS as readonly string[]).includes(
    value,
  );
}

/** Return the UTF-8 byte length used by capture and wire validation. */
function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
