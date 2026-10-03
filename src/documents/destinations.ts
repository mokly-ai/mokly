import path from "node:path";

import { encodeUrlPath, isSafeRepositoryPath } from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import { isInside, projectRealPath, toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError, isMoklyError } from "../errors.js";

import {
  documentTargetKind,
  regularDocumentTarget,
  readDocumentResource,
} from "./destination_files.js";
import {
  documentResourceOutput,
  isDocumentResource,
} from "./resource_paths.js";

type DocumentEntry = Extract<ResolvedRegistryEntry, { kind: "document" }>;

/** Confined filesystem reads are separate from Markdown tokenization and rendering. */
export function resolveDocumentDestinations(
  entry: DocumentEntry,
  destinations: readonly { value: string; image: boolean }[],
  documents: ReadonlyMap<string, DocumentEntry>,
  config: ResolvedConfig,
  root: string,
  outputs: Map<string, Uint8Array>,
  owners: Map<string, string>,
): {
  links: ReadonlyMap<string, string | null>;
  resources: readonly string[];
  sourceFiles: readonly string[];
} {
  const links = new Map<string, string | null>();
  const resources = new Set<string>();
  const sourceFiles = new Set<string>();
  const fail = (message: string): never => {
    throw new MoklyError("build-invalid", `${entry.location}: ${message}`);
  };
  for (const { value } of destinations) {
    if (links.has(value)) continue;
    if (
      /^(?:https?:|mailto:)/i.test(value) ||
      value.startsWith("mock:") ||
      value.startsWith("#")
    ) {
      links.set(value, value);
      continue;
    }
    const parts = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(value)!;
    let relative: string;
    try {
      relative = decodeURIComponent(parts[1]!);
    } catch {
      fail(`link target ${value} is not a portable relative path`);
    }
    if (
      !relative! ||
      /^(?:\/|[A-Za-z][A-Za-z\d+.-]*:)/.test(relative!) ||
      relative!.includes("\\") ||
      [...relative!].some(
        (character) =>
          character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      )
    )
      fail(`link target ${value} is not a portable relative path`);
    const candidate = path.resolve(path.dirname(entry.sourcePath), relative!);
    const resource = isDocumentResource(candidate);
    const real = regularDocumentTarget(candidate);
    if (real === undefined) {
      if (resource && !isInside(root, candidate))
        fail(`resource ${value} is outside the root`);
      if (!isInside(config.repoRoot, candidate))
        fail(`link target ${value} is outside the repository`);
      fail(`link target ${value} does not exist`);
    }
    let kind: ReturnType<typeof documentTargetKind>;
    try {
      kind = documentTargetKind(candidate, real!, config);
    } catch (error) {
      if (isMoklyError(error)) throw error;
      fail(`link target ${value} does not exist`);
    }
    if (kind! === "generated")
      fail(`link target ${value} targets Mokly-owned output or metadata`);
    if (
      resource &&
      kind! !== "public" &&
      (!isInside(root, candidate) || !isInside(projectRealPath(root), real!))
    )
      fail(`resource ${value} is outside the root`);
    if (
      !isInside(config.repoRoot, candidate) ||
      !isInside(projectRealPath(config.repoRoot), real!)
    )
      fail(`link target ${value} is outside the repository`);
    const target = documents.get(candidate);
    if (kind! === "public" && !target) {
      links.set(value, null);
      continue;
    }
    sourceFiles.add(candidate);
    if (target) {
      if (parts[2]) fail(`link target ${value} must not contain a query`);
      let fragment = parts[3] ?? "";
      try {
        fragment = decodeURIComponent(fragment);
      } catch {
        fail(`link target ${value} is not a portable relative path`);
      }
      if (fragment === "#") fragment = "";
      links.set(value, `mock:${target.path}${fragment}`);
    } else if (resource) {
      const source = toPosixPath(path.relative(config.repoRoot, candidate));
      if (
        !isSafeRepositoryPath(source) ||
        (real !== candidate &&
          real !==
            path.resolve(projectRealPath(root), path.relative(root, candidate)))
      )
        fail(
          `resource ${value} must be a regular file without symlink aliases`,
        );
      const output = documentResourceOutput(
        { path: entry.path, sourcePath: entry.sourceRelativePath },
        source,
      );
      if (!output) fail(`resource ${value} is outside the output`);
      if (output!.denial) fail(`resource ${value} ${output!.denial}`);
      const route = output!.route;
      const owner = owners.get(route.toLowerCase());
      if (owner !== undefined && (owner !== source || !outputs.has(route)))
        fail(
          `resource ${value} collides with another generated resource at ${route}`,
        );
      owners.set(route.toLowerCase(), source);
      if (!outputs.has(route)) {
        const bytes = readDocumentResource(candidate);
        if (!bytes) fail(`link target ${value} does not exist`);
        outputs.set(route, bytes!);
      }
      resources.add(source);
      const href = path.posix.relative(entry.path, route);
      links.set(
        value,
        `${href.startsWith(".") ? "" : "./"}${encodeUrlPath(href)}${parts[2] ?? ""}${parts[3] ?? ""}`,
      );
    } else links.set(value, null);
  }
  return {
    links,
    resources: [...resources].sort(),
    sourceFiles: [...sourceFiles].sort(),
  };
}
