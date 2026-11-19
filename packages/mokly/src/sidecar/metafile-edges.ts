import path from "node:path";

import type { Metafile } from "esbuild";

type Selection =
  { kind: "physical"; file: string } | { kind: "own" } | { kind: "unknown" };

/** Interpret physical modules and Mokly namespaces without resolving imports again. */
export class MetafileEdges {
  constructor(
    private readonly metafile: Metafile,
    private readonly sourceRoot: string,
  ) {}

  own(file: string): boolean {
    return (
      file.startsWith("mokly-authoring:") ||
      file.startsWith("mokly-jsx:") ||
      file.startsWith("mokly-style:") ||
      file === "mokly-entry" ||
      path.normalize(file) === path.join(this.sourceRoot, "mokly-entry")
    );
  }

  private clean(file: string): string {
    return file.startsWith("mokly-css:")
      ? file.slice("mokly-css:".length)
      : file;
  }

  physical(file: string): string {
    return path.resolve(this.sourceRoot, this.clean(file));
  }

  /** A style wrapper selects its first import, before any registry dependency. */
  selection(file: string): Selection {
    const seen = new Set<string>();
    while (file.startsWith("mokly-style:")) {
      if (seen.has(file)) return { kind: "unknown" };
      seen.add(file);
      const first = this.metafile.inputs[file]?.imports[0];
      if (!first || first.external) return { kind: "unknown" };
      file = first.path;
    }
    if (this.own(file)) return { kind: "own" };
    file = this.clean(file);
    return path.isAbsolute(file)
      ? { kind: "physical", file }
      : { kind: "unknown" };
  }

  /** The graph retains every wrapper dependency, including a separate registry. */
  imports(file: string): string[] {
    return (this.metafile.inputs[file]?.imports ?? []).flatMap((edge) =>
      edge.external
        ? []
        : edge.path.startsWith("mokly-style:")
          ? this.imports(edge.path)
          : this.own(edge.path)
            ? []
            : [this.physical(edge.path)],
    );
  }
}
