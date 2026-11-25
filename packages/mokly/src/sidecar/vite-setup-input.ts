import fs from "node:fs";
import path from "node:path";

import { fileDigest, missingFile } from "./file-digests.js";

export interface SetupInput {
  name: string;
  file: string | undefined;
  digest: string | null;
}

export class ConfigReads {
  readonly files = new Map<string, Set<string>>();
  readonly probes = new Map<string, boolean>();

  record(file: string, digest?: string): void {
    const digests = this.files.get(file) ?? new Set<string>();
    if (digest !== undefined) digests.add(digest);
    this.files.set(file, digests);
  }
}

export function setupChanged(name: string): never {
  throw new Error(`Vite setup changed during compilation at ${name}`);
}

/** Find the real location of a candidate, including one that is still absent. */
export function candidateLocation(file: string): string {
  try {
    return fs.realpathSync.native(file);
  } catch (error) {
    const parent = path.dirname(file);
    if (!missingFile(error) || parent === file) throw error;
    return path.join(candidateLocation(parent), path.basename(file));
  }
}

/** A directory with a candidate's name stays watchable without being hashed. */
export async function setupCandidate(
  name: string,
  file: string,
): Promise<SetupInput> {
  try {
    const stat = fs.statSync(file, { throwIfNoEntry: false });
    if (stat && !stat.isFile()) return { name, file: undefined, digest: null };
  } catch (error) {
    if (!missingFile(error)) throw error;
  }
  return { name, file, digest: await fileDigest(file) };
}
