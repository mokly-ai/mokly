import { generatedBytes, type GeneratedFile } from "../build/generated_file.js";

import type { ReviewAssetReader } from "./assets.js";

/** Prefer checked compilation bytes, including optional CSS counterparts. */
export class CompilationAssetReader implements ReviewAssetReader {
  constructor(
    private readonly outputs: ReadonlyMap<string, GeneratedFile>,
    private readonly resources: ReviewAssetReader,
  ) {}

  async read(route: string): Promise<Uint8Array> {
    const generated = this.outputs.get(route);
    return generated === undefined
      ? this.resources.read(route)
      : generatedBytes(generated);
  }

  async readIfExists(route: string): Promise<Uint8Array | undefined> {
    const generated = this.outputs.get(route);
    return generated === undefined
      ? this.resources.readIfExists?.(route)
      : generatedBytes(generated);
  }
}
