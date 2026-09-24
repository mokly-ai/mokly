import fs from "node:fs";
import path from "node:path";

import { isSafeRepositoryPath } from "@mokly/viewer/data";
import type { HistoricalManifest } from "@mokly/viewer/data";

import { joinCataloguePath } from "../baseline/catalogue.js";
import type { FileLocation } from "../config/file_locations.js";
import { isInside } from "../config/paths.js";
import {
  privateStaticPathReason,
  publicPathLocation,
} from "../config/public_files.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError, errorMessage } from "../errors.js";
import { generatedManifestRoutes } from "../registry/generated_routes.js";

import type { BaselineReader, GitFile } from "./git.js";

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
    manifest?: HistoricalManifest,
  ) {
    this.generatedRoutes = manifest
      ? generatedManifestRoutes(manifest)
      : new Set();
    this.generatedLayout =
      git.catalogue?.layout ??
      (manifest?.schemaVersion === 6 ? "generated-v6" : "legacy");
    const catalogueRoot = git.catalogue?.catalogueRoot ?? mockupsPrefix;
    this.config = {
      ...config,
      mockupsDir: path.resolve(config.repoRoot, catalogueRoot),
      generatedDir: path.resolve(
        config.repoRoot,
        this.generatedLayout === "generated-v6"
          ? (git.catalogue?.generatedRoot ??
              joinCataloguePath(catalogueRoot, ".generated"))
          : joinCataloguePath(catalogueRoot, ".generated"),
      ),
    };
  }

  private readonly config: ResolvedConfig;
  private readonly generatedRoutes: ReadonlySet<string>;
  private readonly generatedLayout: "generated-v6" | "legacy";

  private repoPath(route: string): string {
    const generated = this.generatedRoutes.has(route);
    return joinCataloguePath(
      generated
        ? (this.git.catalogue?.generatedRoot ??
            (this.generatedLayout === "generated-v6"
              ? joinCataloguePath(this.mockupsPrefix, ".generated")
              : this.mockupsPrefix))
        : (this.git.catalogue?.catalogueRoot ?? this.mockupsPrefix),
      route,
    );
  }

  async readIfExists(route: string): Promise<Uint8Array | undefined> {
    assertPublicStaticRoute(
      route,
      this.config,
      this.generatedRoutes.has(route) &&
        this.generatedLayout === "generated-v6",
    );
    const repoPath = this.repoPath(route);
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
      assertPublicStaticRoute(
        route,
        this.config,
        this.generatedRoutes.has(route) &&
          this.generatedLayout === "generated-v6",
      );
      return {
        repoPath: this.repoPath(route),
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
  generated = false,
): string {
  if (!isSafeRepositoryPath(route)) throw assetError(route, "unsafe path");
  const candidate = path.resolve(
    generated ? config.generatedDir : config.mockupsDir,
    route,
  );
  const denial =
    generated && isInside(config.generatedDir, candidate)
      ? undefined
      : privateStaticPathReason(candidate, config, false);
  if (!isInside(config.mockupsDir, candidate) || denial) {
    throw assetError(
      route,
      `not a public static file${denial ? `: ${denial}` : ""}`,
    );
  }
  return candidate;
}

export function assetError(
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
