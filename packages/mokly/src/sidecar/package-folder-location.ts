import { FolderCandidates } from "./folder-candidates.js";
import { mappedSelection } from "./mapped-selection.js";
import type { PackageJson } from "./package-json.js";
import { packageFolderFiles } from "./package-map.js";
import { inside } from "./path-scope.js";
import type { PhysicalInputs } from "./physical-inputs.js";

/** Keep resolution paths separate from canonical observation identities. */
export class PackageFolderLocation {
  private candidateDescription: FolderCandidates | undefined;
  usedNegative = false;
  canonicalDirectory: string | undefined;
  identity: string | undefined;

  constructor(
    readonly directory: string,
    readonly file: string,
    readonly manifest: PackageJson | undefined,
    readonly selected: string | undefined,
    readonly provenance: "self" | "installed" | "pnp",
    private readonly inputs: PhysicalInputs,
    private readonly observe: boolean,
  ) {}

  describe(): FolderCandidates {
    return (this.candidateDescription ??= new FolderCandidates(this.observe));
  }

  contains(reuseNegative = false): boolean {
    if (this.selected !== undefined && inside(this.directory, this.selected))
      return true;
    if (reuseNegative && this.inputs.notDirectory(this.directory)) {
      this.usedNegative = true;
      return false;
    }
    this.canonicalDirectory ??= this.inputs.canonicalDirectory(
      this.directory,
      false,
    );
    return (
      this.canonicalDirectory !== undefined &&
      (this.selected === undefined ||
        inside(this.canonicalDirectory, this.selected))
    );
  }

  capture(): void {
    this.canonicalDirectory ??= this.inputs.canonicalDirectory(
      this.directory,
      this.observe,
    );
    if (this.observe) this.inputs.file(this.file);
    this.identity = this.inputs.canonicalFile(this.file, this.observe);
  }

  matches(
    base: string,
    extensions: readonly string[],
    folder = false,
  ): boolean {
    if (this.selected === undefined) return false;
    if (mappedSelection(base, this.selected, extensions) !== undefined)
      return true;
    if (folder)
      for (const file of packageFolderFiles(base, extensions))
        if (this.inputs.canonicalFile(file, false) === this.selected)
          return true;
    return false;
  }
}
