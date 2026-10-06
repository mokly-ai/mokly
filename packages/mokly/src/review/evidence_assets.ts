/** Record the checked bytes so later comparisons cannot silently use edited output. */
import { createHash } from "node:crypto";

import { MoklyError } from "../errors.js";

import { type LocatedReviewAsset, type ReviewAssetReader } from "./assets.js";
import { CompiledReviewAssetReader } from "./head_assets.js";

export class EvidenceAssetReader extends CompiledReviewAssetReader {
  readonly digests: Record<string, string> = Object.create(null);

  override async readLocated(route: string): Promise<LocatedReviewAsset> {
    const asset = await super.readLocated(route);
    if (asset.content !== undefined) {
      const digest = assetDigest(asset.content);
      if (this.digests[route] && this.digests[route] !== digest)
        throw changedAsset(route);
      this.digests[route] = digest;
    }
    return asset;
  }
}

/** Bounded capture shared by all reads on a snapshot side, including transitive assets. */
export class SelectedAssetReader implements ReviewAssetReader {
  private readonly files = new Map<string, Uint8Array | undefined>();
  private bytes = 0;
  constructor(
    private readonly reader: ReviewAssetReader,
    private readonly signal: AbortSignal,
    private readonly digests?: Readonly<Record<string, string>>,
  ) {}

  async read(route: string): Promise<Uint8Array> {
    return (await this.readMany([route])).get(route)!;
  }

  async readMany(
    routes: readonly string[],
  ): Promise<ReadonlyMap<string, Uint8Array>> {
    const loaded = await this.readManyIfExists(routes);
    const files = new Map<string, Uint8Array>();
    for (const route of routes) {
      const content = loaded.get(route);
      if (content === undefined)
        throw new MoklyError(
          "review-invalid",
          `Snapshot file is missing: ${route}`,
        );
      files.set(route, content);
    }
    return files;
  }

  /** Capture optional CSS counterparts with the same confinement, digests, and byte budget. */
  async readManyIfExists(
    routes: readonly string[],
  ): Promise<ReadonlyMap<string, Uint8Array | undefined>> {
    this.signal.throwIfAborted();
    const missing = [...new Set(routes)].filter(
      (route) => !this.files.has(route),
    );
    const loaded = missing.length
      ? this.reader.readManyIfExists
        ? await this.reader.readManyIfExists(missing)
        : undefined
      : undefined;
    for (const route of missing) {
      this.signal.throwIfAborted();
      const content = loaded
        ? loaded.get(route)
        : this.reader.readIfExists
          ? await this.reader.readIfExists(route)
          : await this.reader.read(route);
      if (loaded && !loaded.has(route))
        throw new MoklyError(
          "review-invalid",
          `Snapshot batch omitted the file: ${route}`,
        );
      const expected =
        this.digests && Object.hasOwn(this.digests, route)
          ? this.digests[route]
          : undefined;
      if (
        expected &&
        (content === undefined || assetDigest(content) !== expected)
      )
        throw changedAsset(route);
      this.bytes += content?.byteLength ?? 0;
      if (this.bytes > 64 * 1024 * 1024)
        throw new MoklyError(
          "review-invalid",
          "Selected comparison exceeds 64 MiB",
        );
      this.files.set(route, content);
    }
    this.signal.throwIfAborted();
    return new Map(routes.map((route) => [route, this.files.get(route)!]));
  }
}

function assetDigest(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function changedAsset(route: string): MoklyError {
  return new MoklyError(
    "review-invalid",
    `Comparison input changed since the catalogue was checked: ${route}`,
  );
}
