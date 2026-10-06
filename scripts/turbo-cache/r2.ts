import type {
  Headers as R2Headers,
  R2Bucket,
  R2Object,
} from "@cloudflare/workers-types";

import { CacheError } from "./errors.js";
import { duration } from "./metadata.js";
import type {
  ArtifactBody,
  ArtifactDescriptor,
  ArtifactMetadata,
  ArtifactStore,
} from "./store.js";

export type BucketBinding = Pick<R2Bucket, "head" | "get" | "put">;

interface LengthStream {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
}

function knownLength(size: number): LengthStream {
  const runtime = globalThis as unknown as {
    FixedLengthStream: new (length: number) => LengthStream;
  };
  return new runtime.FixedLengthStream(size);
}

function descriptor(object: R2Object): ArtifactDescriptor {
  const data = object.customMetadata ?? {};
  if (
    !Number.isSafeInteger(object.size) ||
    object.size < 0 ||
    !["trusted-writer", "pr-writer", "reader"].includes(data.principal ?? "")
  )
    throw new CacheError(
      500,
      "internal_error",
      "Invalid stored artifact metadata.",
    );
  let storedDuration: string;
  try {
    storedDuration = duration(data.duration ?? "0");
  } catch {
    throw new CacheError(
      500,
      "internal_error",
      "Invalid stored artifact metadata.",
    );
  }
  const metadata: ArtifactMetadata = {
    duration: storedDuration,
    principal: data.principal as ArtifactMetadata["principal"],
  };
  for (const field of ["tag", "sha", "dirtyHash"] as const)
    if (data[field] !== undefined) metadata[field] = data[field];
  return { size: object.size, metadata };
}

/** R2-specific types stay at this boundary; callers consume ArtifactStore. */
export class R2ArtifactStore implements ArtifactStore {
  constructor(
    private readonly bucket: BucketBinding,
    private readonly makeLengthStream: (
      size: number,
    ) => LengthStream = knownLength,
  ) {}

  async head(key: string): Promise<ArtifactDescriptor | null> {
    const object = await this.bucket.head(key);
    return object ? descriptor(object) : null;
  }

  async get(key: string): Promise<ArtifactBody | null> {
    const object = await this.bucket.get(key);
    if (!object) return null;
    return {
      ...descriptor(object),
      body: object.body as unknown as ReadableStream<Uint8Array>,
    };
  }

  async putIfAbsent(
    key: string,
    body: ReadableStream<Uint8Array>,
    metadata: ArtifactMetadata,
    size: number,
  ): Promise<boolean> {
    const fixed = this.makeLengthStream(size);
    const copying = body.pipeTo(fixed.writable);
    const copyResult = copying.then(
      () => ({ error: undefined as unknown }),
      (error: unknown) => ({ error }),
    );
    try {
      const object = await this.bucket.put(
        key,
        fixed.readable as unknown as Parameters<R2Bucket["put"]>[1],
        {
          onlyIf: new Headers({ "If-None-Match": "*" }) as unknown as R2Headers,
          customMetadata: { ...metadata },
          httpMetadata: { contentType: "application/octet-stream" },
        },
      );
      if (object === null && !fixed.readable.locked)
        await fixed.readable.pipeTo(new WritableStream<Uint8Array>());
      const result = await copyResult;
      if (result.error !== undefined) throw result.error;
      return object !== null;
    } catch (error) {
      await fixed.readable.cancel().catch(() => undefined);
      await copyResult;
      throw error;
    }
  }
}
