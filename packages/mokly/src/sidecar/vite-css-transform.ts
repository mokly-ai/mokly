import type { Plugin, ResolvedConfig, ViteDevServer } from "vite";

import type { ViteCssResult } from "../generated/sidecar/ViteCssResult.js";

import { fileDigest, metadataDigest } from "./file-digests.js";
import { viteCssPath, ViteCssUrls } from "./vite-css-paths.js";
import { recordViteInput } from "./vite-inputs.js";
import { viteMetadata } from "./vite-metadata.js";
import type { ViteInputs } from "./vite-plugin.js";
import { viteFile } from "./vite-urls.js";

class InlineStylesheet {
  readonly file: string;
  readonly id: string;
  readonly urls: ViteCssUrls;
  readonly reports = new Set<string>();
  readonly imports = new Map<string, string>();
  classMap: Record<string, string> = {};
  text: string | undefined;

  constructor(
    file: string,
    config: ResolvedConfig,
    private readonly input: ViteInputs,
    stylesheet: string,
  ) {
    this.file = viteCssPath(file);
    this.id = `${this.file}?inline`;
    this.urls = new ViteCssUrls(config, input.paths, stylesheet);
  }

  report = (file: string): void => {
    if (viteCssPath(file) !== this.file) this.reports.add(file);
  };

  async read(id: string, importer?: string): Promise<void> {
    const file = viteFile(id);
    if (!file || viteCssPath(file) === this.file) return;
    await recordViteInput(this.input, file);
    this.imports.set(file, viteFile(importer ?? "") ?? this.file);
  }
}

/** Only the current inline request can use the native stylesheet hooks. */
export class ViteCssTransform {
  active: InlineStylesheet | undefined;

  forId(id: string): InlineStylesheet | undefined {
    const active = this.active;
    if (!active || !id.endsWith("?inline")) return;
    const file = viteFile(id);
    if (file && viteCssPath(file) === active.file) return active;
  }

  capture(): Plugin {
    return {
      name: "mokly-inline-css",
      enforce: "post",
      transform: {
        order: "post",
        handler: (code, id) => {
          const active = this.forId(id);
          if (active) active.text = inlineText(code);
        },
      },
    };
  }

  async run(
    server: ViteDevServer,
    setupFiles: string[],
    input: ViteInputs,
    stylesheet: string,
    physical: string,
  ): Promise<{ result: ViteCssResult; reports: Map<string, string | null> }> {
    const file = await input.paths.resolve(physical);
    const active = new InlineStylesheet(file, server.config, input, stylesheet);
    this.active = active;
    try {
      await recordViteInput(input, file);
      const environment = server.environments.ssr!;
      const graph = environment.moduleGraph;
      const prior = graph.getModuleById(active.id);
      if (prior) graph.invalidateModule(prior);
      await environment.transformRequest(`/@fs/${active.id}`);
      const dependencies: ViteCssResult["dependencies"] = {};
      const importedBy: ViteCssResult["importedBy"] = {};
      const reported = new Set<string>();
      const reports = new Map<string, string | null>();
      const inputs = new Set([...active.reports, ...active.imports.keys()]);
      for (const dependency of [...inputs].sort()) {
        if (active.urls.owns(dependency)) continue;
        const file = await input.paths.metadata(dependency);
        const digest = await metadataDigest(file, {}, input.files.get(file));
        const name = input.paths.name(file);
        dependencies[name] = digest;
        const importer = active.imports.get(dependency);
        if (active.reports.has(dependency)) reported.add(name);
        else if (importer) importedBy[name] = input.paths.name(importer);
        reports.set(file, digest);
      }
      for (const name of reported) delete importedBy[name];
      const metadata = await viteMetadata(
        input,
        setupFiles,
        new Set([file, ...inputs]),
      );
      const sourceDigest = await metadataDigest(
        file,
        {},
        input.files.get(file),
      );
      if (!sourceDigest || active.text === undefined)
        throw new Error("Vite did not return an inline stylesheet");
      for (const [name, digest] of Object.entries(metadata.inputs)) {
        if ((await fileDigest(name)) !== digest)
          throw new Error(
            `${input.paths.metadataName(name)} changed during Vite compilation`,
          );
      }
      return {
        reports,
        result: {
          text: active.text,
          classMap: active.classMap,
          sourceDigest,
          dependencies,
          importedBy,
          metadataInputs: metadata.metadataInputs,
        },
      };
    } finally {
      this.active = undefined;
    }
  }
}

function inlineText(code: string): string {
  const value = /^export default ("(?:[^"\\]|\\[\s\S])*")\s*;?$/.exec(
    code.trim(),
  )?.[1];
  if (!value) throw new Error("Vite did not return an inline stylesheet");
  const text: unknown = JSON.parse(value);
  if (typeof text !== "string")
    throw new Error("Vite did not return an inline stylesheet");
  return text;
}
