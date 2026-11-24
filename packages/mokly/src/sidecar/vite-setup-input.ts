import fs from "node:fs";
import path from "node:path";

import { fileDigest, missingFile } from "./file-digests.js";

export interface SetupInput {
  name: string;
  file: string | undefined;
  digest: string | null;
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
