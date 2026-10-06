import type { CacheBindings } from "../../scripts/turbo-cache/auth.js";
import type {
  ArtifactBody,
  ArtifactDescriptor,
  ArtifactMetadata,
  ArtifactStore,
} from "../../scripts/turbo-cache/store.js";

export const cacheBindings: CacheBindings = {
  TURBO_CACHE_TEAM: "mokly",
  TURBO_CACHE_TRUSTED_WRITE_TOKEN: "trusted-test-token-".padEnd(64, "t"),
  TURBO_CACHE_PR_WRITE_TOKEN: "pr-test-token-".padEnd(64, "p"),
  TURBO_CACHE_READ_TOKEN: "reader-test-token-".padEnd(64, "r"),
};

const tokens = {
  trusted: cacheBindings.TURBO_CACHE_TRUSTED_WRITE_TOKEN!,
  pr: cacheBindings.TURBO_CACHE_PR_WRITE_TOKEN!,
  reader: cacheBindings.TURBO_CACHE_READ_TOKEN!,
};

interface SavedArtifact extends ArtifactDescriptor {
  bytes: Uint8Array;
}

/** Buffering is intentional only in the in-memory test implementation. */
export class MemoryArtifactStore implements ArtifactStore {
  readonly objects = new Map<string, SavedArtifact>();
  readonly reads: string[] = [];
  readonly writes: string[] = [];
  failure = false;

  async head(key: string): Promise<ArtifactDescriptor | null> {
    if (this.failure) throw new Error("private storage diagnostic");
    this.reads.push(key);
    const object = this.objects.get(key);
    return object
      ? { size: object.size, metadata: { ...object.metadata } }
      : null;
  }

  async get(key: string): Promise<ArtifactBody | null> {
    const metadata = await this.head(key);
    const object = this.objects.get(key);
    return object && metadata
      ? { ...metadata, body: new Response(Uint8Array.from(object.bytes)).body! }
      : null;
  }

  async putIfAbsent(
    key: string,
    body: ReadableStream<Uint8Array>,
    metadata: ArtifactMetadata,
    _size: number,
  ): Promise<boolean> {
    if (this.failure) throw new Error("private storage diagnostic");
    this.writes.push(key);
    const bytes = new Uint8Array(await new Response(body).arrayBuffer());
    if (this.objects.has(key)) return false;
    this.objects.set(key, {
      bytes,
      size: bytes.byteLength,
      metadata: { ...metadata },
    });
    return true;
  }
}

export function cacheRequest(
  path = "/v8/artifacts/abc",
  options: {
    method?: string;
    principal?: keyof typeof tokens;
    team?: string;
    body?: string;
    headers?: HeadersInit;
  } = {},
): Request {
  const body = options.body;
  const headers = new Headers({
    Authorization: `Bearer ${tokens[options.principal ?? "trusted"]}`,
  });
  if (body !== undefined) {
    headers.set(
      "Content-Type",
      options.method === "PUT"
        ? "application/octet-stream"
        : "application/json",
    );
    headers.set(
      "Content-Length",
      String(new TextEncoder().encode(body).byteLength),
    );
  }
  for (const [name, value] of new Headers(options.headers))
    headers.set(name, value);
  return new Request(
    `https://cache.example${path}?slug=${options.team ?? "mokly"}`,
    {
      method: options.method ?? "GET",
      headers,
      ...(body !== undefined ? { body } : {}),
    },
  );
}
