import fs from "node:fs";
import path from "node:path";

import type { FileLocation } from "../config/file_locations.js";
import { isInside, isSafeRepositoryPath } from "../config/paths.js";
import {
  privateStaticPathReason,
  publicPathLocation,
} from "../config/public_files.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync } from "../diagnostics/timings.js";
import { MoklyError, errorMessage } from "../errors.js";

import { referencedRoutes } from "./asset_references.js";
import type { BaselineReader, GitFile } from "./git.js";
import { addArtifactFile, snapshotPath } from "./paths.js";
import type { ReviewArtifactContent } from "./types.js";

/** Filesystem boundary for current-worktree Review assets. */
export interface ReviewAssetReader {
  read(route: string): Promise<Uint8Array>;
  /** Distinguish a new resource from a rejected historical path when supported. */
  readIfExists?(route: string): Promise<Uint8Array | undefined>;
  /** Optional bounded bulk read; every requested route must be present or reject. */
  readMany?(
    routes: readonly string[],
  ): Promise<ReadonlyMap<string, Uint8Array>>;
  /** Missing files are explicit; unsafe or non-regular files still reject. */
  readManyIfExists?(
    routes: readonly string[],
  ): Promise<ReadonlyMap<string, Uint8Array | undefined>>;
}

/** A worktree reader that distinguishes absent files from invalid resources. */
export interface OptionalReviewAssetReader extends ReviewAssetReader {
  /** Missing paths still require a confined, existing public ancestor. */
  readIfExists(route: string): Promise<Uint8Array | undefined>;
  /** Expose the validated logical and physical resource identities. */
  readLocated(route: string): Promise<LocatedReviewAsset>;
}

/** Validated public location, including a confined location for a missing file. */
export interface LocatedReviewAsset {
  content?: Uint8Array;
  location: FileLocation;
}

/** Confined filesystem implementation for current-worktree Review assets. */
export class FileSystemReviewAssetReader implements OptionalReviewAssetReader {
  constructor(private readonly config: ResolvedConfig) {}

  async read(route: string): Promise<Uint8Array> {
    const content = await this.readIfExists(route);
    if (content === undefined) throw assetError(route, "file is missing");
    return content;
  }

  async readIfExists(route: string): Promise<Uint8Array | undefined> {
    return (await this.readLocated(route)).content;
  }

  /** Retain the validated physical location so watchers can observe local aliases. */
  async readLocated(route: string): Promise<LocatedReviewAsset> {
    if (!isSafeRepositoryPath(route)) throw assetError(route, "unsafe path");
    const candidate = path.resolve(this.config.mockupsDir, route);
    try {
      const location = publicPathLocation(candidate, this.config);
      if (!location) {
        const denial = privateStaticPathReason(candidate, this.config);
        throw assetError(
          route,
          `not a public static file${denial ? `: ${denial}` : ""}`,
        );
      }
      let stat;
      try {
        stat = await fs.promises.stat(location.physicalPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT")
          return { location };
        throw error;
      }
      if (!stat.isFile()) throw assetError(route, "not a public static file");
      return {
        content: await fs.promises.readFile(location.physicalPath),
        location,
      };
    } catch (error) {
      if (error instanceof MoklyError) throw error;
      throw assetError(route, errorMessage(error), error);
    }
  }
}

/** Confined Git implementation for base-commit Review assets. */
export class GitReviewAssetReader implements ReviewAssetReader {
  constructor(
    config: ResolvedConfig,
    private readonly git: BaselineReader,
    private readonly commit: string,
    private readonly mockupsPrefix: string,
  ) {
    this.config = {
      ...config,
      mockupsDir: path.resolve(config.repoRoot, mockupsPrefix),
    };
  }

  private readonly config: ResolvedConfig;

  async readIfExists(route: string): Promise<Uint8Array | undefined> {
    assertPublicStaticRoute(route, this.config);
    const repoPath = this.mockupsPrefix
      ? `${this.mockupsPrefix}/${route}`
      : route;
    if ((await this.git.fileKind(this.commit, repoPath)) === "missing") return;
    return this.read(route);
  }

  async read(route: string): Promise<Uint8Array> {
    const files = await this.readMany([route]);
    const content = files.get(route);
    if (!content) throw assetError(route, "Git batch omitted the file");
    return content;
  }

  /** Read and validate many base-snapshot assets in one bounded Git batch. */
  async readMany(
    routes: readonly string[],
  ): Promise<ReadonlyMap<string, Uint8Array>> {
    const loaded = await this.readManyIfExists(routes);
    const files = new Map<string, Uint8Array>();
    for (const route of routes) {
      const content = loaded.get(route);
      if (content === undefined)
        throw assetError(route, "not a regular Git file (missing)");
      files.set(route, content);
    }
    return files;
  }

  async readManyIfExists(
    routes: readonly string[],
  ): Promise<ReadonlyMap<string, Uint8Array | undefined>> {
    const requested = [...new Set(routes)].sort().map((route) => {
      assertPublicStaticRoute(route, this.config);
      return {
        repoPath:
          this.mockupsPrefix === "" ? route : `${this.mockupsPrefix}/${route}`,
        route,
      };
    });
    try {
      const repoPaths = requested.map(({ repoPath }) => repoPath);
      const gitFiles = this.git.readFiles
        ? await this.git.readFiles(this.commit, repoPaths)
        : await readGitFilesIndividually(this.git, this.commit, repoPaths);
      const files = new Map<string, Uint8Array | undefined>();
      for (const { repoPath, route } of requested) {
        const file = gitFiles.get(repoPath);
        if (!file || (file.kind !== "regular" && file.kind !== "missing")) {
          throw assetError(
            route,
            `not a regular Git file (${file?.kind ?? "missing"})`,
          );
        }
        files.set(route, file.kind === "regular" ? file.bytes : undefined);
      }
      return files;
    } catch (error) {
      if (
        error instanceof MoklyError &&
        (error.code === "review-invalid" || error.code === "config-invalid")
      ) {
        throw error;
      }
      throw assetError(
        requested[0]?.route ?? "base snapshot",
        errorMessage(error),
        error,
      );
    }
  }
}

/** Copy a pane and every transitively referenced local CSS/static dependency. */
export async function copySnapshotDependencies(
  files: Map<string, ReviewArtifactContent>,
  side: "after" | "before",
  seedRoutes: ReadonlySet<string>,
  read: (route: string) => Promise<ReviewArtifactContent>,
  readMany?: (
    routes: readonly string[],
  ) => Promise<ReadonlyMap<string, ReviewArtifactContent>>,
): Promise<void> {
  return timeAsync("review.resource-graph", async () => {
    let queued = [...seedRoutes].sort();
    const seen = new Set<string>();
    while (queued.length > 0) {
      const batch = queued.filter((route) => !seen.has(route));
      for (const route of batch) seen.add(route);
      const missing = batch.filter(
        (route) => files.get(snapshotPath(side, route)) === undefined,
      );
      if (missing.length > 0) {
        const loaded = readMany
          ? await readMany(missing)
          : await readIndividually(missing, read);
        for (const route of missing) {
          const content = loaded.get(route);
          if (content === undefined) {
            throw assetError(route, "batch reader omitted the file");
          }
          addArtifactFile(files, snapshotPath(side, route), content);
        }
      }
      const discovered = new Set<string>();
      for (const route of batch) {
        const content = files.get(snapshotPath(side, route));
        if (content === undefined) {
          throw assetError(route, "snapshot dependency is unavailable");
        }
        for (const dependency of referencedRoutes(route, content)) {
          if (!seen.has(dependency)) discovered.add(dependency);
        }
      }
      queued = [...discovered].sort();
    }
  });
}

async function readIndividually(
  routes: readonly string[],
  read: (route: string) => Promise<ReviewArtifactContent>,
): Promise<ReadonlyMap<string, ReviewArtifactContent>> {
  const files = new Map<string, ReviewArtifactContent>();
  for (const route of routes) files.set(route, await read(route));
  return files;
}

async function readGitFilesIndividually(
  git: BaselineReader,
  commit: string,
  repoPaths: readonly string[],
): Promise<ReadonlyMap<string, GitFile>> {
  const files = new Map<string, GitFile>();
  for (const repoPath of repoPaths) {
    const kind = await git.fileKind(commit, repoPath);
    files.set(
      repoPath,
      kind === "regular"
        ? { bytes: await git.readFileBytes(commit, repoPath), kind }
        : { kind },
    );
  }
  return files;
}

function assertPublicStaticRoute(
  route: string,
  config: ResolvedConfig,
): string {
  if (!isSafeRepositoryPath(route)) throw assetError(route, "unsafe path");
  const candidate = path.resolve(config.mockupsDir, route);
  const denial = privateStaticPathReason(candidate, config, false);
  if (!isInside(config.mockupsDir, candidate) || denial) {
    throw assetError(
      route,
      `not a public static file${denial ? `: ${denial}` : ""}`,
    );
  }
  return candidate;
}

function assetError(
  route: string,
  detail: string,
  cause?: unknown,
): MoklyError {
  return new MoklyError(
    "review-invalid",
    `could not retain Review asset ${route}: ${detail}`,
    cause === undefined ? undefined : { cause },
  );
}
