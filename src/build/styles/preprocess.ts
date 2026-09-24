import fs from "node:fs/promises";
import path from "node:path";

import { toPosixPath } from "../../config/paths.js";
import type { ResolvedConfig } from "../../config/types.js";
import { MoklyError } from "../../errors.js";

import { scopeModule, type ScopedStyle } from "./modules.js";
import { scanImportPrelude } from "./prelude.js";

/** Consumer preprocessing hook; PostCSS supplies a different implementation later. */
export interface StyleTextProcessor {
  /** Transform one already-pruned source and return validated private files. */
  process(source: string, text: string): Promise<ProcessedStyleText>;
}

/** Plugin output and already-validated private dependency files. */
export interface ProcessedStyleText {
  readonly css: string;
  readonly sourceFiles: readonly string[];
}

/** Identity processor when no PostCSS module has been configured. */
export class IdentityStyleProcessor implements StyleTextProcessor {
  /** Retain the original CSS when the consumer has no PostCSS module. */
  async process(_source: string, text: string): Promise<ProcessedStyleText> {
    return { css: text, sourceFiles: [] };
  }
}

/** A single effective CSS input after pruning, plugins and module scoping. */
export interface PreparedStyle {
  readonly css: string;
  readonly scoped?: ScopedStyle;
}

/** Share preprocessing between the graph and stylesheet passes per compilation. */
export class StylePreprocessor {
  private readonly prepared = new Map<string, Promise<PreparedStyle>>();
  private readonly identities = new Map<string, string>();
  /** Private dependencies reported by the effective stylesheet processors. */
  readonly sourceFiles = new Set<string>();

  constructor(
    private readonly config: ResolvedConfig,
    private readonly processor: StyleTextProcessor = new IdentityStyleProcessor(),
  ) {}

  /** Memoize by file and renderer-exclusion set across both build passes. */
  prepare(
    source: string,
    excluded: ReadonlySet<string> = new Set(),
    resolveImport?: (
      specifier: string,
      importer: string,
    ) => Promise<string | undefined>,
  ): Promise<PreparedStyle> {
    const key = `${source}\0${[...excluded].sort().join("\0")}`;
    let prepared = this.prepared.get(key);
    if (!prepared) {
      prepared = this.load(source, excluded, resolveImport);
      this.prepared.set(key, prepared);
    }
    return prepared;
  }

  private async load(
    source: string,
    excluded: ReadonlySet<string>,
    resolveImport?: (
      specifier: string,
      importer: string,
    ) => Promise<string | undefined>,
  ): Promise<PreparedStyle> {
    let text = await fs.readFile(source, "utf8");
    if (excluded.size && resolveImport) {
      const imports = scanImportPrelude(text);
      for (const entry of [...imports].reverse()) {
        const resolved = await resolveImport(entry.specifier, source);
        if (resolved && excluded.has(resolved))
          text = text.slice(0, entry.start) + text.slice(entry.end);
      }
    }
    const processed = await this.processor.process(source, text);
    for (const file of processed.sourceFiles) this.sourceFiles.add(file);
    text = processed.css;
    if (!source.endsWith(".module.css")) return { css: text };
    const relative = toPosixPath(path.relative(this.config.repoRoot, source));
    const scoped = scopeModule(text, relative);
    for (const name of scoped.identities) {
      const first = this.identities.get(name);
      if (first && first !== relative) {
        throw new MoklyError(
          "build-invalid",
          `CSS Modules generated name collision: ${name} in ${first} and ${relative}; rename one local name or file`,
        );
      }
      this.identities.set(name, relative);
    }
    return { css: scoped.css, scoped };
  }
}
