/** Produce, write, read, and decode the shared example compilation snapshot. */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { normalizeBuildDiagnostics } from "../../dist/build/build_warnings.js";
import { compileCatalogue } from "../../dist/build/compile.js";
import {
  receiveGeneratedFile,
  transferGeneratedFile,
} from "../../dist/build/generated_file.js";
import { loadConfig } from "../../dist/config/load.js";
import {
  MANIFEST_NAME,
  serializeManifest,
} from "../../dist/registry/manifest.js";

import {
  EXAMPLE_SNAPSHOT_PATH,
  EXAMPLE_SNAPSHOT_SCHEMA_VERSION,
  exampleSnapshotKey,
} from "./example-snapshot-key.mjs";

/** Compilation fields that the snapshot stores; any other field is rejected. */
const COMPILATION_FIELDS = new Set([
  "diagnostics",
  "manifest",
  "outputs",
  "deliveredStyleSources",
  "documentMarkdown",
]);
const FIELDS = new Set(["schemaVersion", "key", ...COMPILATION_FIELDS]);

/**
 * Encode a compilation and its freshness key as one JSON-safe object. A
 * compilation field that the snapshot does not store fails the encode, so a
 * new field can never drop out of the snapshot silently.
 */
export function encodeCompilation(compilation, key) {
  for (const field of Object.keys(compilation))
    if (!COMPILATION_FIELDS.has(field))
      throw new Error(
        `example compilation snapshot cannot store compilation field ${field}; add it to scripts/verification/example-snapshot.mjs and docs/protocol/ci-example-snapshot.md`,
      );
  return {
    schemaVersion: EXAMPLE_SNAPSHOT_SCHEMA_VERSION,
    key,
    diagnostics: [...compilation.diagnostics],
    manifest: compilation.manifest,
    outputs: [...compilation.outputs].map(([route, content]) => [
      route,
      transferGeneratedFile(content),
    ]),
    deliveredStyleSources: [...compilation.deliveredStyleSources],
    ...(compilation.documentMarkdown
      ? { documentMarkdown: [...compilation.documentMarkdown] }
      : {}),
  };
}

/**
 * Validate a parsed snapshot and rebuild the compilation it encodes. The
 * manifest must serialize to the compiled manifest output, which the compile
 * wrote only after its strict schema-v10 validation; repeating that validation
 * here would cost seconds in every test process.
 */
export function decodeCompilation(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid("the snapshot must be a JSON object");
  for (const field of Object.keys(value))
    if (!FIELDS.has(field)) invalid(`unexpected field ${field}`);
  if (value.schemaVersion !== EXAMPLE_SNAPSHOT_SCHEMA_VERSION)
    invalid(`expected schema version ${EXAMPLE_SNAPSHOT_SCHEMA_VERSION}`);
  if (typeof value.key !== "string" || !/^[0-9a-f]{64}$/u.test(value.key))
    invalid("the key must be 64 lowercase hexadecimal characters");
  const outputs = pairs(value.outputs, "outputs", (content, route) =>
    plainBytes(
      receiveGeneratedFile(content) ??
        invalid(`output ${route} is not a valid generated file`),
    ),
  );
  const manifest = value.manifest;
  if (
    !manifest ||
    typeof manifest !== "object" ||
    Array.isArray(manifest) ||
    outputs.get(MANIFEST_NAME) !== serializeManifest(manifest)
  )
    invalid(`the manifest must serialize to the ${MANIFEST_NAME} output`);
  const compilation = {
    diagnostics: buildDiagnostics(value.diagnostics),
    manifest,
    outputs,
    deliveredStyleSources: strings(
      value.deliveredStyleSources,
      "deliveredStyleSources",
    ),
  };
  if (value.documentMarkdown !== undefined)
    compilation.documentMarkdown = pairs(
      value.documentMarkdown,
      "documentMarkdown",
      (markdown, file) =>
        typeof markdown === "string"
          ? markdown
          : invalid(`documentMarkdown ${file} must be a string`),
    );
  return compilation;
}

/** Classify the snapshot at `file` against the key that `currentKey` computes. */
export async function readSnapshotFile(file, currentKey) {
  let value;
  try {
    value = JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return { status: "missing" };
    return { status: "invalid", error };
  }
  if (typeof value?.key !== "string")
    return { status: "invalid", error: new Error("the snapshot has no key") };
  if (value.key !== (await currentKey())) return { status: "stale" };
  try {
    return { status: "fresh", compilation: decodeCompilation(value) };
  } catch (error) {
    return { status: "invalid", error };
  }
}

/** Classify the repository snapshot against the current example inputs. */
export function readExampleSnapshot(repositoryRoot) {
  return readSnapshotFile(
    path.join(repositoryRoot, EXAMPLE_SNAPSHOT_PATH),
    () => exampleSnapshotKey(repositoryRoot),
  );
}

/** Write beside the snapshot, then rename, so readers never see a partial file. */
export async function writeExampleSnapshot(file, snapshot) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(snapshot));
    await fs.rename(temporary, file);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

/** Compile and write only when the existing snapshot is not fresh. */
export async function produceExampleSnapshot({ file, key, compile }) {
  const current = await key();
  const existing = await readSnapshotFile(file, async () => current);
  if (existing.status === "fresh") return { status: "fresh" };
  const compilation = await compile();
  if ((await key()) !== current)
    throw new Error(
      "example compilation snapshot inputs changed during the compile; run the producer again",
    );
  await writeExampleSnapshot(file, encodeCompilation(compilation, current));
  return { status: "written", previous: existing.status, compilation };
}

function pairs(value, field, decode) {
  if (!Array.isArray(value)) invalid(`${field} must be an array`);
  const entries = new Map();
  for (const pair of value) {
    if (
      !Array.isArray(pair) ||
      pair.length !== 2 ||
      typeof pair[0] !== "string"
    )
      invalid(`${field} must hold [string, value] pairs`);
    if (entries.has(pair[0])) invalid(`duplicate ${field} entry ${pair[0]}`);
    entries.set(pair[0], decode(pair[1], pair[0]));
  }
  return entries;
}

/** Compiles emit plain `Uint8Array` assets; decoding must not hand back a Buffer. */
function plainBytes(content) {
  return typeof content === "string"
    ? content
    : new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
}

function buildDiagnostics(value) {
  if (
    !Array.isArray(value) ||
    value.some(
      (diagnostic) =>
        !diagnostic ||
        typeof diagnostic !== "object" ||
        Object.keys(diagnostic).sort().join() !== "code,message,route",
    )
  )
    invalid("diagnostics must hold code, route, and message records");
  return normalizeBuildDiagnostics(value);
}

function strings(value, field) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    invalid(`${field} must be an array of strings`);
  return value;
}

function invalid(message) {
  throw new Error(`example compilation snapshot is invalid: ${message}`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
) {
  const repositoryRoot = path.resolve(import.meta.dirname, "../..");
  const result = await produceExampleSnapshot({
    file: path.join(repositoryRoot, EXAMPLE_SNAPSHOT_PATH),
    key: () => exampleSnapshotKey(repositoryRoot),
    compile: async () =>
      compileCatalogue(
        await loadConfig(repositoryRoot, "examples/basic/mokly.config.ts"),
      ),
  });
  console.log(
    result.status === "fresh"
      ? `${EXAMPLE_SNAPSHOT_PATH} is fresh; skipped the example compile`
      : `wrote ${EXAMPLE_SNAPSHOT_PATH} with ${result.compilation.outputs.size} outputs (previous snapshot: ${result.previous})`,
  );
}
