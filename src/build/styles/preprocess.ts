import fs from "node:fs/promises";
import path from "node:path";

import { logicalRepositoryPath } from "../../config/file_locations.js";
import { toPosixPath } from "../../config/paths.js";
import type { ResolvedConfig } from "../../config/types.js";
import { MoklyError } from "../../errors.js";

import { validateImageSetStrings } from "./image_set.js";
import { scopeModule, type ScopedStyle } from "./modules.js";
import { nestedExcludedImports } from "./nested_imports.js";
import type { StyleDependencyReport } from "./postcss.js";
import { scanImportPrelude } from "./prelude.js";

/** Consumer preprocessing hook, shared by graph and stylesheet passes. */
export interface StyleTextProcessor {
  /** Transform one already-pruned source and report unvalidated dependencies. */
  process(source: string, text: string): Promise<ProcessedStyleText>;
}

/** Plugin output and dependencies awaiting graph-wide inventory validation. */
export interface ProcessedStyleText {
  readonly css: string;
  readonly sourceFiles: readonly string[];
  /** Unvalidated plugin messages are checked after graph input discovery. */
  readonly reports?: readonly StyleDependencyReport[];
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
  readonly reports?: readonly StyleDependencyReport[];
}

/** Share preprocessing between the graph and stylesheet passes per compilation. */
export class StylePreprocessor {
  private readonly prepared = new Map<string, Promise<PreparedStyle>>();
  private readonly sourceText = new Map<string, Promise<string>>();
  private readonly identities = new Map<string, string>();
  /** Private dependencies reported by the effective stylesheet processors. */
  readonly sourceFiles = new Set<string>();
  /** Raw reports awaiting package-owned source inventory validation. */
  readonly reports: StyleDependencyReport[] = [];

  constructor(
    private readonly config: ResolvedConfig,
    private readonly processor: StyleTextProcessor = new IdentityStyleProcessor(),
  ) {}

  /** Memoize by file and effectively excluded local imports across both passes. */
  async prepare(
    source: string,
    excluded: ReadonlySet<string> = new Set(),
    resolveImport?: (
      specifier: string,
      importer: string,
    ) => Promise<string | undefined>,
  ): Promise<PreparedStyle> {
    let sourceText = this.sourceText.get(source);
    if (!sourceText) {
      sourceText = fs.readFile(source, "utf8");
      this.sourceText.set(source, sourceText);
    }
    const text = await sourceText;
    const pruned = new Set<string>();
    if (excluded.size && resolveImport)
      for (const entry of scanImportPrelude(text)) {
        const resolved = await resolveImport(entry.specifier, source);
        if (resolved && excluded.has(resolved)) pruned.add(resolved);
      }
    const key = `${source}\0${[...pruned].sort().join("\0")}`;
    let prepared = this.prepared.get(key);
    if (!prepared) {
      prepared = this.load(source, text, pruned, resolveImport);
      this.prepared.set(key, prepared);
    }
    const result = await prepared;
    if (excluded.size && resolveImport && result.reports?.length) {
      const nested = await nestedExcludedImports(
        source,
        text,
        excluded,
        resolveImport,
      );
      for (const report of result.reports) {
        if (report.type !== "dependency" || !report.file) continue;
        const file = logicalRepositoryPath(
          path.resolve(path.dirname(source), report.file),
          this.config.repoRoot,
        );
        const importer = nested.get(file);
        if (importer)
          throw new MoklyError(
            "build-invalid",
            `PostCSS plugin ${report.plugin} reached renderer-owned CSS in ${toPosixPath(path.relative(this.config.repoRoot, source))}: ${toPosixPath(path.relative(this.config.repoRoot, file))} via ${toPosixPath(path.relative(this.config.repoRoot, importer))}; import it only from the renderer, import it directly so Mokly can prune it, or use Tailwind @reference`,
          );
      }
    }
    return result;
  }

  private async load(
    source: string,
    sourceText: string,
    pruned: ReadonlySet<string>,
    resolveImport?: (
      specifier: string,
      importer: string,
    ) => Promise<string | undefined>,
  ): Promise<PreparedStyle> {
    let text = sourceText;
    if (pruned.size && resolveImport) {
      const imports = scanImportPrelude(text);
      for (const entry of [...imports].reverse()) {
        const resolved = await resolveImport(entry.specifier, source);
        if (resolved && pruned.has(resolved))
          text = text.slice(0, entry.start) + text.slice(entry.end);
      }
    }
    const processed = await this.processor.process(source, text);
    this.reports.push(...(processed.reports ?? []));
    for (const file of processed.sourceFiles) this.sourceFiles.add(file);
    text = processed.css;
    validateImageSetStrings(text, source, this.config.repoRoot);
    if (!source.endsWith(".module.css"))
      return {
        css: text,
        ...(processed.reports ? { reports: processed.reports } : {}),
      };
    const relative = toPosixPath(path.relative(this.config.repoRoot, source));
    const scoped = scopeModule(text, relative);
    validateImageSetStrings(scoped.css, source, this.config.repoRoot);
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
    return {
      css: scoped.css,
      scoped,
      ...(processed.reports ? { reports: processed.reports } : {}),
    };
  }
}
