import fs from "node:fs";
import path from "node:path";

import { GENERATED_DIRECTORY, isSafeRepositoryPath } from "@mokly/viewer/data";
import type { HistoricalManifest } from "@mokly/viewer/data";

import { joinCataloguePath } from "../baseline/catalogue.js";
import { isValidGeneratedRoute } from "../build/styles/routes.js";
import type { FileLocation } from "../config/file_locations.js";
import {
  isInternalCatalogueFile,
  privateStaticPathReason,
  publicPathLocation,
} from "../config/public_files.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError, errorMessage } from "../errors.js";

import { assetError, assertPublicStaticRoute } from "./asset_paths.js";
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
    const catalogueRoot = git.catalogue?.catalogueRoot ?? mockupsPrefix;
    this.config = {
      ...config,
      mockupsDir: path.resolve(config.repoRoot, catalogueRoot),
      generatedDir: path.resolve(
        config.repoRoot,
        catalogueRoot,
        GENERATED_DIRECTORY,
      ),
    };
    this.publicRoutes = manifest
      ? new Set([
          ...manifest.generatedFiles.map(
            (item) => `${GENERATED_DIRECTORY}/${item.path}`,
          ),
          ...manifest.assetClosure,
        ])
      : undefined;
  }

  private readonly config: ResolvedConfig;
  private readonly publicRoutes: ReadonlySet<string> | undefined;
  private readonly loaded = new Map<string, Promise<Uint8Array | undefined>>();

  private repoPath(route: string): string {
    return joinCataloguePath(
      this.git.catalogue?.catalogueRoot ?? this.mockupsPrefix,
      route,
    );
  }

  private assertRoute(route: string): void {
    if (!isSafeRepositoryPath(route)) throw assetError(route, "unsafe path");
    if (
      isInternalCatalogueFile(
        path.resolve(this.config.mockupsDir, route),
        this.config,
        false,
      )
    )
      throw assetError(route, "targets internal catalogue metadata");
    if (route.startsWith(`${GENERATED_DIRECTORY}/`)) {
      if (
        !this.publicRoutes?.has(route) &&
        !isValidGeneratedRoute(route.slice(GENERATED_DIRECTORY.length + 1))
      )
        throw assetError(route, "not an accepted generated resource");
    } else assertPublicStaticRoute(route, this.config);
  }

  async readIfExists(route: string): Promise<Uint8Array | undefined> {
    return (await this.readManyIfExists([route])).get(route);
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
    for (const route of routes) {
      this.assertRoute(route);
      if (this.publicRoutes && !this.publicRoutes.has(route))
        throw assetError(route, "outside historical asset closure");
    }
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
    const unique = [...new Set(routes)].sort();
    const missing = unique.filter((route) => !this.loaded.has(route));
    if (missing.length) {
      const batch = this.loadFiles(missing);
      for (const route of missing)
        this.loaded.set(
          route,
          batch.then((files) => files.get(route)),
        );
    }
    return new Map(
      await Promise.all(
        unique.map(
          async (route) => [route, await this.loaded.get(route)] as const,
        ),
      ),
    );
  }

  private async loadFiles(
    routes: readonly string[],
  ): Promise<ReadonlyMap<string, Uint8Array | undefined>> {
    const files = new Map<string, Uint8Array | undefined>();
    const requested = [...new Set(routes)].sort().flatMap((route) => {
      this.assertRoute(route);
      if (this.publicRoutes && !this.publicRoutes.has(route)) {
        files.set(route, undefined);
        return [];
      }
      return [{ repoPath: this.repoPath(route), route }];
    });
    try {
      const repoPaths = requested.map(({ repoPath }) => repoPath);
      const gitFiles = this.git.readFiles
        ? await this.git.readFiles(this.commit, repoPaths)
        : await readGitFilesIndividually(this.git, this.commit, repoPaths);
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
