import path from "node:path";

import type { Metafile } from "esbuild";

import { virtualEntry } from "./bundle-entry.js";
import { resolutionRequest } from "./resolution-request.js";
import type { LookupRequest } from "./resolution-request.js";
import { bareSpecifier } from "./specifier.js";

export type SelectedImport =
  { kind: "physical"; file: string } | { kind: "unknown" };
type Selection = SelectedImport | { kind: "own" };

export interface MetafileCursor {
  input: number;
  edge: number;
}

interface MetafileRequest extends MetafileCursor {
  request: LookupRequest;
  selected: string;
  paths: boolean;
  folder: boolean;
  deferred: boolean;
}

function aliased(
  original: string,
  aliases: ReadonlyArray<readonly [string, string]>,
): boolean {
  for (let index = 0; index < aliases.length; index++) {
    const key = aliases[index]![0];
    if (
      original === key ||
      (original.startsWith(key) && original.charCodeAt(key.length) === 47)
    )
      return true;
  }
  return false;
}

/** Interpret physical modules and Mokly namespaces without resolving imports again. */
export class MetafileEdges {
  private readonly entry: string;
  private requestInputs:
    Array<[string, Metafile["inputs"][string]]> | undefined;

  constructor(
    private readonly metafile: Metafile,
    private readonly sourceRoot: string,
  ) {
    this.entry = path.join(sourceRoot, virtualEntry);
  }

  own(file: string): boolean {
    return (
      file.startsWith("mokly-authoring:") ||
      file.startsWith("mokly-jsx:") ||
      file.startsWith("mokly-style:") ||
      file === virtualEntry ||
      file === this.entry ||
      (file.includes(virtualEntry) && path.normalize(file) === this.entry)
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
    let seen: Set<string> | undefined;
    while (file.startsWith("mokly-style:")) {
      seen ??= new Set<string>();
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

  /** Both marked recorders share request interpretation without retaining request results. */
  *requests(
    aliases: ReadonlyArray<readonly [string, string]>,
    configuration: string,
    start?: MetafileCursor,
  ): Generator<MetafileRequest> {
    this.requestInputs ??= Object.entries(this.metafile.inputs);
    for (
      let inputIndex = start?.input ?? 0;
      inputIndex < this.requestInputs.length;
      inputIndex++
    ) {
      const [file, input] = this.requestInputs[inputIndex]!;
      if (!path.isAbsolute(file) || this.own(file)) continue;
      let directory: string | undefined;
      let dependency: boolean | undefined;
      const first = start && inputIndex === start.input ? start.edge : 0;
      for (
        let edgeIndex = first;
        edgeIndex < input.imports.length;
        edgeIndex++
      ) {
        const edge = input.imports[edgeIndex]!;
        if (edge.external || edge.original === undefined) continue;
        const original = edge.original;
        const bare = bareSpecifier(original);
        if (!bare && !original.startsWith("#") && !aliased(original, aliases))
          continue;
        directory ??= path.dirname(file);
        const request = resolutionRequest(
          original,
          directory,
          aliases,
          configuration,
        );
        if (request.kind !== "lookup") continue;
        dependency ??= file.split(path.sep).includes("node_modules");
        const effectiveBare = bareSpecifier(request.name);
        const paths =
          !dependency &&
          bare &&
          (effectiveBare || path.isAbsolute(request.name));
        const folder = effectiveBare || request.name.startsWith("#");
        if (!paths && !folder) continue;
        yield {
          input: inputIndex,
          edge: edgeIndex,
          request,
          selected: edge.path,
          paths,
          folder,
          deferred:
            folder &&
            (request.name.startsWith("#") ||
              !bare ||
              (dependency && request.directory !== directory)),
        };
      }
    }
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
