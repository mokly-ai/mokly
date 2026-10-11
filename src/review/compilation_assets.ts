import { generatedResourceRoute } from "@mokly/viewer/data";

import { generatedBytes, type GeneratedFile } from "../build/generated_file.js";

import type { ReviewAssetReader } from "./assets.js";
import type { DeletionAssetRead } from "./deletion_read.js";

/** Prefer checked compilation bytes, including optional CSS counterparts. */
export class CompilationAssetReader implements ReviewAssetReader {
  constructor(
    private readonly outputs: ReadonlyMap<string, GeneratedFile>,
    private readonly resources: ReviewAssetReader,
  ) {}

  async read(route: string): Promise<Uint8Array> {
    const generated = this.outputs.get(generatedResourceRoute(route) ?? "");
    return generated === undefined
      ? this.resources.read(route)
      : generatedBytes(generated);
  }

  async readIfExists(route: string): Promise<Uint8Array | undefined> {
    const generated = this.outputs.get(generatedResourceRoute(route) ?? "");
    return generated === undefined
      ? this.resources.readIfExists?.(route)
      : generatedBytes(generated);
  }

  async readForDeletion(route: string): Promise<DeletionAssetRead> {
    const generated = generatedResourceRoute(route);
    if (generated !== undefined) {
      const value = this.outputs.get(generated);
      return value === undefined
        ? { kind: "absent" }
        : { kind: "present", bytes: generatedBytes(value) };
    }
    if (this.resources.readForDeletion)
      return this.resources.readForDeletion(route);
    const bytes = await this.readIfExists(route);
    return bytes === undefined
      ? { kind: "missing" }
      : { kind: "present", bytes };
  }
}
