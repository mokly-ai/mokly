import fs from "node:fs";
import path from "node:path";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import { isExportIgnoredPath } from "../export/ignored.js";

import { locatePath, type FileLocation } from "./file_locations.js";
import { publicResourceDenial } from "./public_denial.js";
import { publicFileLocation } from "./public_files.js";
import type { ResolvedConfig } from "./types.js";

export type PublicFileDecision =
  | { readonly kind: "public"; readonly location: FileLocation }
  | { readonly kind: "missing" }
  | {
      readonly kind: "private";
      readonly reason: string;
      readonly location?: FileLocation;
    };

/** One generation's shared authored-file classification, never a read-time authorization. */
export class PublicFilePolicy {
  private readonly decisions = new Map<string, PublicFileDecision>();
  private readonly denial: (name: string) => string | undefined;

  constructor(private readonly config: ResolvedConfig) {
    this.denial = publicResourceDenial(config);
  }

  inspect(name: string): PublicFileDecision {
    const prior = this.decisions.get(name);
    if (prior) return prior;
    const result = this.classify(name);
    this.decisions.set(name, result);
    return result;
  }

  read(name: string): Buffer | undefined {
    const decision = this.inspect(name);
    if (decision.kind !== "public") return;
    return readPublicFile(this.config, name, decision.location);
  }

  private classify(name: string): PublicFileDecision {
    try {
      if (!isSafeRepositoryPath(name))
        return {
          kind: "private",
          reason: "is not a safe repository-relative path",
        };
      const candidate = path.resolve(this.config.mockupsDir, name);
      const reason =
        this.denial(name) ??
        (isExportIgnoredPath(candidate, this.config.repoRoot)
          ? "is inside owned export or transaction output"
          : undefined);
      if (reason) return { kind: "private", reason };
      const location =
        publicFileLocation(candidate, this.config) ??
        locatePath(candidate, this.config.mockupsDir, this.config.repoRoot);
      if (!location) return { kind: "missing" };
      if (!regularPublicPath(this.config, name))
        return {
          kind: "private",
          reason: "is a symlink or non-regular file",
          location,
        };
      return { kind: "public", location };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return { kind: "missing" };
      return { kind: "private", reason: "could not read the public path" };
    }
  }
}

/** Recheck every path component before opening a public file without following links. */
function regularPublicPath(config: ResolvedConfig, name: string): boolean {
  let current = config.mockupsDir;
  const segments = name.split("/");
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment);
    const stat = fs.lstatSync(current);
    if (
      stat.isSymbolicLink() ||
      (index === segments.length - 1 ? !stat.isFile() : !stat.isDirectory())
    )
      return false;
  }
  return true;
}

function readPublicFile(
  config: ResolvedConfig,
  name: string,
  location: FileLocation,
): Buffer | undefined {
  try {
    if (!regularPublicPath(config, name)) return;
    const current = locatePath(
      location.logicalPath,
      config.mockupsDir,
      config.repoRoot,
    );
    if (!current || current.physicalPath !== location.physicalPath) return;
    const handle = fs.openSync(
      current.physicalPath,
      fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
    );
    try {
      if (!fs.fstatSync(handle).isFile()) return;
      const content = fs.readFileSync(handle);
      if (!regularPublicPath(config, name)) return;
      const after = locatePath(
        location.logicalPath,
        config.mockupsDir,
        config.repoRoot,
      );
      return after?.physicalPath === current.physicalPath ? content : undefined;
    } finally {
      fs.closeSync(handle);
    }
  } catch {
    return;
  }
}
