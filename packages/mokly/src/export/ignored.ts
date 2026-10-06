import fs from "node:fs";
import path from "node:path";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import { isInside, projectRealPath, toPosixPath } from "../config/paths.js";

import {
  EXPORT_MARKER,
  parseExportOwnership,
  type ExportOwnershipParseResult,
} from "./ownership.js";
import { isReservationDirectory } from "./reservation.js";
import { exportReservation, TRANSACTION_MARKER } from "./transaction.js";

const MAX_MARKER_BYTES = 64 * 1024 * 1024;
const DEFAULT_CACHE_ENTRIES = 64;

interface MarkerStat {
  ctimeMs?: number;
  dev: bigint | number;
  ino: bigint | number;
  isFile(): boolean;
  mtimeMs: number;
  size: number;
}

/** Injectable synchronous marker boundary used by Watch ownership checks. */
export interface ExportIgnoredReader {
  lstat(candidate: string): MarkerStat;
  parse(content: string): ExportOwnershipParseResult;
  read(candidate: string): string;
}

interface CachedOwnership {
  directories: ReadonlySet<string>;
  paths: ReadonlySet<string>;
}

const NODE_READER: ExportIgnoredReader = {
  lstat: (candidate) => fs.lstatSync(candidate),
  parse: parseExportOwnership,
  read: (candidate) => fs.readFileSync(candidate, "utf8"),
};

/** Bounded ownership cache for repeated synchronous Watch ignore checks. */
export class ExportIgnoredMatcher {
  readonly #cache = new Map<string, CachedOwnership | undefined>();

  constructor(
    readonly reader: ExportIgnoredReader = NODE_READER,
    readonly capacity = DEFAULT_CACHE_ENTRIES,
  ) {}

  /** Recognize proven output/reservations, not similarly named authored files. */
  isIgnored(
    candidate: string,
    repoRoot: string,
    mode: "traverse" | "event" = "event",
  ): boolean {
    for (
      let directory = candidate;
      isInside(repoRoot, directory) && directory !== repoRoot;
      directory = path.dirname(directory)
    ) {
      const ownership = this.#readOwnership(directory);
      if (ownership) {
        const relative = toPosixPath(path.relative(directory, candidate));
        if (relative === EXPORT_MARKER || ownership.paths.has(relative))
          return true;
        if (
          mode === "event" &&
          (relative === "" || ownership.directories.has(relative))
        )
          return true;
        return false;
      }
      if (isReservationDirectory(directory)) return true;
      if (this.#validReservation(directory)) return true;
      try {
        if (this.#validReservation(exportReservation(directory))) return true;
      } catch {
        // A disappearing unowned path is not proof of export ownership.
      }
    }
    return false;
  }

  #readOwnership(directory: string): CachedOwnership | undefined {
    const candidate = path.join(directory, EXPORT_MARKER);
    let stat: MarkerStat;
    try {
      stat = this.reader.lstat(candidate);
    } catch {
      return;
    }
    if (!stat.isFile() || stat.size > MAX_MARKER_BYTES) return;
    const key = markerKey(stat);
    if (this.#cache.has(key)) {
      const cached = this.#cache.get(key);
      this.#cache.delete(key);
      this.#cache.set(key, cached);
      return cached;
    }
    let ownership: CachedOwnership | undefined;
    try {
      const parsed = this.reader.parse(this.reader.read(candidate));
      if (parsed.kind === "valid")
        ownership = cacheOwnership(parsed.value.files);
    } catch {
      // Unreadable and malformed markers prove no ownership.
    }
    this.#cache.set(key, ownership);
    while (this.#cache.size > Math.max(1, this.capacity)) {
      const oldest = this.#cache.keys().next().value;
      if (oldest === undefined) break;
      this.#cache.delete(oldest);
    }
    return ownership;
  }

  #validReservation(directory: string): boolean {
    const content = this.#readMarker(directory, TRANSACTION_MARKER);
    if (!content) return false;
    try {
      const value: unknown = JSON.parse(content);
      if (
        !value ||
        typeof value !== "object" ||
        !("schemaVersion" in value) ||
        value.schemaVersion !== 2 ||
        !("output" in value) ||
        typeof value.output !== "string" ||
        !isSafeRepositoryPath(value.output) ||
        value.output.includes("/")
      )
        return false;
      return (
        projectRealPath(
          exportReservation(
            path.join(
              path.dirname(path.dirname(path.dirname(directory))),
              value.output,
            ),
          ),
        ) === projectRealPath(directory)
      );
    } catch {
      return false;
    }
  }

  #readMarker(directory: string, marker: string): string | undefined {
    try {
      const candidate = path.join(directory, marker);
      const stat = this.reader.lstat(candidate);
      return stat.isFile() && stat.size <= MAX_MARKER_BYTES
        ? this.reader.read(candidate)
        : undefined;
    } catch {
      return;
    }
  }
}

const DEFAULT_MATCHER = new ExportIgnoredMatcher();

/** Recognize proven output/reservations, not unrelated similarly named files. */
export function isExportIgnoredPath(
  candidate: string,
  repoRoot: string,
  mode: "traverse" | "event" = "event",
): boolean {
  return DEFAULT_MATCHER.isIgnored(candidate, repoRoot, mode);
}

function markerKey(stat: MarkerStat): string {
  return [stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs ?? ""].join(
    ":",
  );
}

function cacheOwnership(files: readonly { path: string }[]): CachedOwnership {
  const paths = new Set(files.map(({ path: name }) => name));
  const directories = new Set<string>();
  for (const name of paths) {
    const parts = name.split("/");
    parts.pop();
    while (parts.length > 0) {
      directories.add(parts.join("/"));
      parts.pop();
    }
  }
  return { directories, paths };
}
