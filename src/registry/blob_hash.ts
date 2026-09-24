import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

export type GitObjectFormat = "sha1" | "sha256";

/** Isolate the optional Git object-format lookup from deterministic hashing. */
export interface GitObjectFormatReader {
  format(repoRoot: string): GitObjectFormat;
}

export class RepositoryObjectFormatReader implements GitObjectFormatReader {
  format(repoRoot: string): GitObjectFormat {
    try {
      const value = execFileSync(
        "git",
        ["-C", repoRoot, "rev-parse", "--show-object-format"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      ).trim();
      if (value === "sha256") return value;
    } catch {
      return "sha1";
    }
    return "sha1";
  }
}

/** Hash the exact bytes as a Git blob object in the repository's format. */
export function gitBlobHash(
  bytes: Uint8Array,
  algorithm: GitObjectFormat,
): string {
  return createHash(algorithm)
    .update(`blob ${bytes.byteLength}\0`)
    .update(bytes)
    .digest("hex");
}
