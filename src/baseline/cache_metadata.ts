import path from "node:path";

import {
  assertMockupsPath,
  MAX_MARKER_BYTES,
  parseCompletionMarker,
  type CacheLayout,
  type CompletionMarker,
} from "./cache_layout.js";
import { assertBaselineActive } from "./errors.js";
import type { BaselineFileSystem } from "./types.js";

export interface CacheMetadata {
  readonly marker: CompletionMarker;
  readonly mockupsPath: string;
}

/** Read only current completion metadata; retention never inspects output bytes. */
export async function readCacheMetadata(
  fs: BaselineFileSystem,
  layout: CacheLayout,
  commit: string,
  signal?: AbortSignal,
): Promise<CacheMetadata | undefined> {
  try {
    assertBaselineActive(signal);
    const inputs = path.join(layout.entry, "inputs.json");
    if (
      (await fs.stat(layout.marker))?.kind !== "regular" ||
      (await fs.stat(inputs))?.kind !== "regular"
    )
      return;
    const marker = parseCompletionMarker(
      JSON.parse(
        Buffer.from(await fs.read(layout.marker, MAX_MARKER_BYTES)).toString(
          "utf8",
        ),
      ),
      commit,
    );
    if (!marker) return;
    const mockupsPath: unknown = JSON.parse(
      Buffer.from(await fs.read(inputs, MAX_MARKER_BYTES)).toString("utf8"),
    );
    if (typeof mockupsPath !== "string") return;
    assertMockupsPath(mockupsPath);
    assertBaselineActive(signal);
    return { marker, mockupsPath };
  } catch {
    assertBaselineActive(signal);
    return;
  }
}
