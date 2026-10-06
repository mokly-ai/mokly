import path from "node:path";
import { getSystemErrorName } from "node:util";

import type * as koffi from "koffi";

import { exportError } from "./error.js";

/** One OS move with absence enforced by the kernel, not an earlier path check. */
interface ExclusiveRename {
  move(from: string, to: string): void;
}

/** Atomically move a directory without replacing any destination entry. */
export async function renameExclusive(from: string, to: string): Promise<void> {
  if ([from, to].some((name) => !path.isAbsolute(name) || name.includes("\0")))
    throw exportError(
      "Exclusive export rename requires absolute, NUL-free paths.",
    );
  let operation: ExclusiveRename;
  try {
    const { default: bridge } = await import("koffi");
    operation = nativeRename(bridge);
  } catch (error) {
    throw exportError(
      `Exclusive export rename is unavailable on ${process.platform}/${process.arch}. Install the package's optional native dependencies on a supported platform; no replacing-rename fallback is used.`,
      error,
    );
  }
  operation.move(from, to);
}

/** Bind only fixed signatures and flags; never expose consumer-selected symbols. */
function nativeRename(bridge: typeof koffi.default): ExclusiveRename {
  if (process.platform === "win32") {
    const library = bridge.load("kernel32.dll");
    const move: (from: string, to: string, flags: number) => number =
      library.func("__stdcall", "MoveFileExW", "int", [
        "str16",
        "str16",
        "uint32",
      ]);
    const lastError: () => number = library.func(
      "__stdcall",
      "GetLastError",
      "uint32",
      [],
    );
    return {
      move: (from, to) => {
        const result = move(
          path.toNamespacedPath(from),
          path.toNamespacedPath(to),
          0,
        );
        if (result === 0) {
          const code = lastError();
          throw exportError(
            `Exclusive export rename failed (${code}): ${from} -> ${to}.`,
          );
        }
      },
    };
  }
  if (process.platform !== "linux" && process.platform !== "darwin")
    throw exportError(
      `Unsupported exclusive-rename platform: ${process.platform}.`,
    );
  const library = bridge.load(null);
  const move: (from: string, to: string) => number =
    process.platform === "darwin"
      ? darwinRename(library)
      : linuxRename(library);
  return {
    move: (from, to) => {
      if (move(from, to) !== 0) {
        const errno = bridge.errno();
        const code = getSystemErrorName(-errno);
        throw exportError(
          `Exclusive export rename failed (${code}): ${from} -> ${to}.`,
        );
      }
    },
  };
}

function darwinRename(
  library: koffi.LibraryHandle,
): (from: string, to: string) => number {
  const rename: (from: string, to: string, flags: number) => number =
    library.func(
      "int renamex_np(const char *from, const char *to, unsigned int flags)",
    );
  const RENAME_EXCL = 4;
  return (from, to) => rename(from, to, RENAME_EXCL);
}

function linuxRename(
  library: koffi.LibraryHandle,
): (from: string, to: string) => number {
  const rename: (
    fromFd: number,
    from: string,
    toFd: number,
    to: string,
    flags: number,
  ) => number = library.func(
    "int renameat2(int from_fd, const char *from, int to_fd, const char *to, unsigned int flags)",
  );
  const AT_FDCWD = -100;
  const RENAME_NOREPLACE = 1;
  return (from, to) => rename(AT_FDCWD, from, AT_FDCWD, to, RENAME_NOREPLACE);
}
