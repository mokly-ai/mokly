import { parse } from "@babel/parser";

export type ExportParserMode = "typescript" | "tsx";

interface Entry {
  readonly source: string;
  readonly modes: Partial<Record<ExportParserMode, readonly string[]>>;
  charge: number;
}

export class ExportNameCache {
  private readonly entries = new Map<string, Entry>();
  private bytes = 0;

  constructor(
    readonly capacity = 1024 * 1024,
    private readonly parseSource: typeof parse = parse,
  ) {}

  /** Retained data charge, not measured V8 heap use. */
  get retainedBytes(): number {
    return this.bytes;
  }

  names(source: string, mode: ExportParserMode): readonly string[] {
    const entry = this.entries.get(source);
    const cached = entry?.modes[mode];
    if (cached) {
      this.touch(entry);
      return cached;
    }
    const names = Object.freeze(this.parseNames(entry?.source ?? source, mode));
    const charge =
      (entry?.charge ?? 64 + source.length * 2) +
      names.reduce((total, name) => total + 16 + name.length * 2, 0);
    if (charge > this.capacity) {
      if (entry) this.touch(entry);
      return names;
    }
    if (entry) {
      this.entries.delete(entry.source);
      this.bytes -= entry.charge;
    }
    while (this.bytes + charge > this.capacity) {
      const oldest = this.entries.values().next().value;
      if (!oldest) break;
      this.entries.delete(oldest.source);
      this.bytes -= oldest.charge;
    }
    const retained = entry ?? { source, modes: {}, charge: 0 };
    retained.modes[mode] = names;
    retained.charge = charge;
    this.entries.set(retained.source, retained);
    this.bytes += charge;
    return names;
  }

  private touch(entry: Entry): void {
    // Babel names can retain source slices, so keep the stored source key.
    this.entries.delete(entry.source);
    this.entries.set(entry.source, entry);
  }

  private parseNames(source: string, mode: ExportParserMode): string[] {
    const ast = this.parseSource(source, {
      sourceType: "unambiguous",
      plugins: mode === "typescript" ? ["typescript"] : ["typescript", "jsx"],
    });
    const names: string[] = [];
    for (const node of ast.program.body) {
      if (node.type === "ExportDefaultDeclaration") names.push("default");
      if (node.type !== "ExportNamedDeclaration") continue;
      for (const item of node.specifiers)
        names.push(
          item.exported.type === "Identifier"
            ? item.exported.name
            : item.exported.value,
        );
      const declaration = node.declaration;
      if (declaration?.type === "VariableDeclaration") {
        for (const item of declaration.declarations)
          if (item.id.type === "Identifier") names.push(item.id.name);
      } else if (
        declaration &&
        "id" in declaration &&
        declaration.id?.type === "Identifier"
      )
        names.push(declaration.id.name);
    }
    return names;
  }
}

export const exportNameCache = new ExportNameCache();
