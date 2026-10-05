import fs from "node:fs";
import path from "node:path";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import type { EntryDiscovery } from "../config/entry_discovery.js";
import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";
import {
  deriveEntryPath,
  entryLinkBase,
  movedFromDiagnostic,
} from "../registry/path_derivation.js";

import { resolveDocumentDestinations } from "./destinations.js";
import { parseFrontMatter } from "./front_matter.js";
import { renderMarkdown } from "./markdown.js";
import { isIndexDocument } from "./resource_paths.js";

export type ResolvedDocument = Extract<
  ResolvedRegistryEntry,
  { kind: "document" }
>;

/** Load file definitions and their copyable assets once per accepted graph. */
export function loadDocuments(
  config: ResolvedConfig,
  discovery: EntryDiscovery,
): {
  entries: readonly ResolvedDocument[];
  outputs: ReadonlyMap<string, Uint8Array>;
  sources: readonly string[];
} {
  const files = discovery.resolvedFiles.filter((file) => /\.md$/i.test(file));
  const indexes = new Map<string, string>();
  const parsed = files.map((sourcePath) => {
    const location = toPosixPath(path.relative(config.repoRoot, sourcePath));
    const root = config.roots[discovery.rootByFile[location]!]!;
    const file = toPosixPath(path.relative(root.dir, sourcePath));
    if (isIndexDocument(file)) {
      const directory = toPosixPath(path.dirname(location));
      const previous = indexes.get(directory);
      if (previous)
        throw new MoklyError(
          "build-invalid",
          `[duplicate-index] directory ${directory} has two index documents: ${previous} and ${path.basename(file)}`,
        );
      indexes.set(directory, path.basename(file));
    }
    const { metadata, body } = parseFrontMatter(
      fs.readFileSync(sourcePath, "utf8"),
      location,
    );
    const identity = deriveEntryPath({
      file,
      location,
      document: true,
      ...(root.path ? { prefix: root.path } : {}),
      transparent: root.transparent,
      ...(metadata.path === undefined ? {} : { path: metadata.path }),
    });
    if ("code" in identity)
      throw new MoklyError(
        "build-invalid",
        `[${identity.code}] ${identity.message}`,
      );
    const move = movedFromDiagnostic(metadata.movedFrom, location);
    if (move)
      throw new MoklyError("build-invalid", `[${move.code}] ${move.message}`);
    const markdown = renderMarkdown(body);
    const leaf = path.basename(file).split(".")[0]!;
    const fallback = leaf.replace(/[-_]/g, " ");
    const title =
      metadata.title ??
      markdown.title ??
      (fallback.trim() ? fallback[0]!.toUpperCase() + fallback.slice(1) : leaf);
    const entry: ResolvedDocument = {
      ...metadata,
      ...identity,
      kind: "document",
      title,
      description: metadata.description ?? "",
      dependencies: [],
      relatedDocs: [],
      resources: [],
      sourcePath,
      sourceRelativePath: location,
      location,
      entryRoot: sourcePath,
      linkBase: entryLinkBase(identity.path, identity.index),
      body: "",
      markdown: body,
    };
    return { entry, body, markdown, root };
  });
  const documents = new Map(
    parsed.map(({ entry }) => [entry.sourcePath, entry]),
  );
  const outputs = new Map<string, Uint8Array>();
  const owners = new Map<string, string>();
  const sources = new Set(files);
  for (const { entry, body, markdown, root } of parsed) {
    const resolved = resolveDocumentDestinations(
      entry,
      markdown.destinations,
      documents,
      config,
      root.dir,
      outputs,
      owners,
    );
    entry.resources = resolved.resources;
    for (const source of resolved.sourceFiles) sources.add(source);
    entry.body = renderMarkdown(
      body,
      (value) =>
        resolved.links.get(value) ?? (resolved.links.has(value) ? null : value),
    ).html;
  }
  return { entries: [...documents.values()], outputs, sources: [...sources] };
}
