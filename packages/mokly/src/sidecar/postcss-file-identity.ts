import fs from "node:fs";

import type { PostcssFileIdentity } from "../generated/sidecar/PostcssFileIdentity.js";

const fstat = fs.fstatSync;
const stat = fs.statSync;
const realpath = fs.realpathSync.native;

/** Object identity comes from the open descriptor, not a second content read. */
export function fileIdentity(
  fd: number,
  file: string,
): PostcssFileIdentity | undefined {
  try {
    const opened = fstat(fd, { bigint: true });
    if (!opened.isFile() || opened.ino === 0n) return;
    const identity: PostcssFileIdentity = {
      object: `${opened.dev}:${opened.ino}`,
    };
    try {
      const canonical = realpath(file);
      const selected = stat(canonical, { bigint: true });
      if (selected.dev === opened.dev && selected.ino === opened.ino)
        identity.canonical = canonical;
    } catch {
      /* An unavailable name never replaces descriptor evidence. */
    }
    return identity;
  } catch {
    return;
  }
}
