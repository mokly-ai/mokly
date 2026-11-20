import type { CaptureStat } from "./capture-runtime.js";

export type CaptureKind = "absent" | "file" | "directory" | "link" | "other";

/** The first no-follow kind is enough for a second presence or kind probe. */
export function captureKind(
  stat:
    Pick<CaptureStat, "isSymbolicLink" | "isDirectory" | "isFile"> | undefined,
): CaptureKind {
  return !stat
    ? "absent"
    : stat.isSymbolicLink()
      ? "link"
      : stat.isDirectory()
        ? "directory"
        : stat.isFile()
          ? "file"
          : "other";
}
