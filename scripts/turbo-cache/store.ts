import type { Principal } from "./auth.js";

export interface ArtifactMetadata {
  duration: string;
  principal: Principal;
  tag?: string;
  sha?: string;
  dirtyHash?: string;
}

export interface ArtifactDescriptor {
  size: number;
  metadata: ArtifactMetadata;
}

export interface ArtifactBody extends ArtifactDescriptor {
  body: ReadableStream<Uint8Array>;
}

/** The core needs no R2 globals or platform-specific filesystem operations. */
export interface ArtifactStore {
  head(key: string): Promise<ArtifactDescriptor | null>;
  get(key: string): Promise<ArtifactBody | null>;
  putIfAbsent(
    key: string,
    body: ReadableStream<Uint8Array>,
    metadata: ArtifactMetadata,
    size: number,
  ): Promise<boolean>;
}
