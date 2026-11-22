import path from "node:path";

import type { ImportKind } from "esbuild";

import type { ReuseEvidence } from "../generated/sidecar/ReuseEvidence.js";

import { folderCandidateOrder } from "./folder-candidate-order.js";
import type { ModulePaths } from "./module-paths.js";
import type { PhysicalInputs } from "./physical-inputs.js";

/** Check a marked selection against the final recorded directory names. */
export class FolderSelectionProof {
  constructor(
    private readonly bases: string[],
    private readonly selected: string,
    private readonly kind: ImportKind,
    private readonly inputs: PhysicalInputs,
    private readonly paths: ModulePaths,
  ) {}

  async matches(
    listings: Record<string, string[]>,
    evidence: ReuseEvidence,
  ): Promise<boolean> {
    let reached = false;
    try {
      const keys = new Map<string, Promise<string>>();
      const key = (directory: string) => {
        let result = keys.get(directory);
        if (!result) {
          result = this.paths.metadata(directory);
          keys.set(directory, result);
        }
        return result;
      };
      for (const base of this.bases) {
        let position = 0;
        let targetReaches = false;
        for (const candidate of folderCandidateOrder(
          base,
          this.kind,
          this.paths.settings,
          this.inputs,
        )) {
          if (
            candidate === this.selected ||
            this.inputs.canonicalFile(candidate, false) === this.selected
          ) {
            targetReaches = true;
            break;
          }
          position++;
        }
        if (!this.inputs.complete) return false;
        if (!targetReaches) continue;
        reached = true;
        let remaining = position;
        for (const candidate of folderCandidateOrder(
          base,
          this.kind,
          this.paths.settings,
          this.inputs,
        )) {
          if (remaining-- === 0) break;
          const directory = await key(path.dirname(candidate));
          const names = listings[directory];
          if (!names) return false;
          const wanted = fold(path.basename(candidate));
          for (const name of names) {
            if (fold(name) !== wanted) continue;
            const file = path.join(path.dirname(candidate), name);
            const pin =
              evidence.inputs[file] ??
              evidence.inputs[path.join(directory, name)];
            if (pin?.kind === "absent") continue;
            if (pin?.kind === "link") {
              if (evidence.inputs[pin.target]?.kind === "absent") continue;
              if (listings[pin.target]?.length) continue;
            }
            return false;
          }
        }
      }
      return reached;
    } catch {
      return false;
    }
  }
}

function fold(name: string): string {
  return Array.from(name, (point) =>
    point === "\u0130" ? "i" : point.toLowerCase(),
  ).join("");
}
