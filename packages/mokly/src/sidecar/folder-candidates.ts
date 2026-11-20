import path from "node:path";

import type { ModulePaths } from "./module-paths.js";
import type { PackageFolderLocation } from "./package-folder-location.js";
import { packageFolderCandidates } from "./package-map.js";
import { EVIDENCE_LIMIT } from "./physical-input-reader.js";
import type { PhysicalInputs } from "./physical-inputs.js";

export function folderRowBytes(file: string): number {
  return 2 * Buffer.byteLength(JSON.stringify(file)) + 128;
}

/** Marked descriptions reserve rows; full audits retain only candidate presence. */
export class FolderCandidates {
  readonly values: string[] = [];
  present = false;
  overflow = false;
  private readonly bases = new Map<string, number>();
  private readonly rows = new Set<string>();
  private bytes = 0;

  constructor(private readonly retain = true) {}

  private reserve(base: string): boolean {
    if (this.bases.has(base)) return true;
    const rows = new Set([
      path.dirname(base),
      base,
      path.join(base, "package.json"),
    ]);
    let bytes = 0;
    for (const row of rows)
      if (!this.rows.has(row)) bytes += folderRowBytes(row);
    if (bytes > EVIDENCE_LIMIT - this.bytes) {
      this.overflow = true;
      this.release();
      return false;
    }
    this.bytes += bytes;
    for (const row of rows) this.rows.add(row);
    this.bases.set(base, 0);
    return true;
  }

  expand(base: string): boolean {
    if (!this.retain) return true;
    if (this.overflow) return true;
    if ((this.bases.get(base) ?? 0) & 2) return false;
    if (!this.reserve(base)) return true;
    this.bases.set(base, this.bases.get(base)! | 2);
    return true;
  }

  add(base: string): boolean {
    this.present = true;
    if (!this.retain) return true;
    if (this.overflow) return true;
    if ((this.bases.get(base) ?? 0) & 1) return false;
    if (!this.reserve(base)) return true;
    this.bases.set(base, this.bases.get(base)! | 1);
    this.values.push(base);
    return true;
  }

  merge(other: FolderCandidates): void {
    if (other === this) return;
    this.present ||= other.present;
    if (!this.retain) {
      other.release();
      return;
    }
    if (other.overflow) {
      this.overflow = true;
      this.release();
    } else if (!this.overflow)
      for (const base of other.values) {
        this.add(base);
        if (this.overflow) break;
        this.bases.set(
          base,
          this.bases.get(base)! | (other.bases.get(base) ?? 0),
        );
      }
    other.release();
  }

  release(): void {
    this.values.length = 0;
    this.bases.clear();
    this.rows.clear();
    this.bytes = 0;
  }
}

/** Overflow retains no expanded paths while known selections still get a complete placement check. */
export function collectFolderCandidates(
  candidates: FolderCandidates,
  base: string,
  location: PackageFolderLocation,
  inputs: PhysicalInputs,
  paths: ModulePaths,
  observe: boolean,
  current: boolean,
  placed: boolean,
): boolean {
  if (!candidates.expand(base)) return placed;
  const check = () => {
    if (!inputs.complete) throw new Error("package folder input limit");
    if (candidates.overflow && (placed || location.selected === undefined))
      throw new Error("package folder lookup limit");
  };
  check();
  for (const candidate of packageFolderCandidates(
    base,
    inputs,
    paths.settings.mainFields,
    observe,
    current,
    true,
  )) {
    check();
    if (candidates.add(candidate) && !placed)
      placed = location.matches(
        candidate,
        paths.settings.resolveExtensions,
        true,
      );
    check();
  }
  check();
  return placed;
}
