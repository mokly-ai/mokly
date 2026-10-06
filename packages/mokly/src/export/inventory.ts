import type { ReviewArtifactContent } from "@mokly/viewer/data";

import { ExportPathIndex } from "./path_index.js";
import { assertPortableExportPath } from "./portable_path.js";

/** A single collision-checked namespace for every deployed file. */
export class ExportInventory {
  readonly files = new Map<string, ReviewArtifactContent>();
  readonly #paths = new ExportPathIndex();

  /** Add a safe file, permitting only byte-identical exact-path duplicates. */
  add(name: string, content: ReviewArtifactContent): void {
    assertPortableExportPath(name);
    const previous = this.files.get(name);
    if (
      previous !== undefined &&
      Buffer.from(previous).equals(Buffer.from(content))
    )
      return;
    this.#paths.add(name);
    this.files.set(name, content);
  }
}
