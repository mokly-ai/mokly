import { createHash } from "node:crypto";

import type { ExportOwnership } from "../export/ownership.js";

import type { PublishUploadProgress } from "./types.js";

interface DigestEntries {
  count: number;
  size: number;
}

/** Digest-based command and round accounting over ownership marker entries. */
export class PublishAccounting {
  readonly #entries = new Map<string, DigestEntries>();
  readonly #planContents = new Map<string, number>();
  readonly #sent = new Set<string>();
  readonly #entryCount: number;

  constructor(
    ownership: ExportOwnership,
    planFiles: ReadonlyMap<string, Buffer>,
  ) {
    this.#entryCount = ownership.files.length;
    for (const entry of ownership.files) {
      const existing = this.#entries.get(entry.sha256);
      this.#entries.set(entry.sha256, {
        count: (existing?.count ?? 0) + 1,
        size: entry.size,
      });
    }
    for (const bytes of planFiles.values()) {
      const digest = sha256(bytes);
      if (!this.#planContents.has(digest))
        this.#planContents.set(digest, bytes.length);
      this.#sent.add(digest);
    }
  }

  /** Begin one Plan round with fresh per-round progress accounting. */
  startRound(missing: readonly string[]): PublishRoundAccounting {
    return new PublishRoundAccounting(
      this.#entries,
      this.#planContents,
      missing,
    );
  }

  /** Record that the first request attempt for one Blob digest has started. */
  blobAttemptStarted(digest: string): void {
    this.#sent.add(digest);
  }

  /** Return final marker-entry counts for the entire command. */
  result(): { uploaded: number; unchanged: number } {
    let uploaded = 0;
    for (const digest of this.#sent)
      uploaded += this.#entries.get(digest)?.count ?? 0;
    return { uploaded, unchanged: this.#entryCount - uploaded };
  }
}

/** Progress accounting for one receiver Plan response. */
class PublishRoundAccounting {
  readonly #entries: ReadonlyMap<string, DigestEntries>;
  readonly #included = new Set<string>();
  readonly #completed = new Set<string>();
  readonly #total: number;
  readonly #totalBytes: number;
  #completedEntries = 0;

  constructor(
    entries: ReadonlyMap<string, DigestEntries>,
    planContents: ReadonlyMap<string, number>,
    missing: readonly string[],
  ) {
    this.#entries = entries;
    const sizes = new Map(planContents);
    for (const digest of planContents.keys()) {
      this.#included.add(digest);
      this.#completed.add(digest);
      this.#completedEntries += entries.get(digest)?.count ?? 0;
    }
    for (const digest of missing) {
      this.#included.add(digest);
      if (!sizes.has(digest)) sizes.set(digest, entries.get(digest)?.size ?? 0);
    }
    let total = 0;
    for (const digest of this.#included)
      total += entries.get(digest)?.count ?? 0;
    this.#total = total;
    this.#totalBytes = [...sizes.values()].reduce((sum, size) => sum + size, 0);
  }

  /** Return the current immutable progress value for this round. */
  progress(): PublishUploadProgress {
    return {
      completed: this.#completedEntries,
      total: this.#total,
      totalBytes: this.#totalBytes,
    };
  }

  /** Mark one requested digest stored and return the advanced progress. */
  blobCompleted(digest: string): PublishUploadProgress {
    if (this.#included.has(digest) && !this.#completed.has(digest)) {
      this.#completed.add(digest);
      this.#completedEntries += this.#entries.get(digest)?.count ?? 0;
    }
    return this.progress();
  }
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
