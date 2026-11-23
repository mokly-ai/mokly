import type { Plugin, ResolvedConfig, ViteDevServer } from "vite";

import type { ViteCssResult } from "../generated/sidecar/ViteCssResult.js";

import { fileDigest, metadataDigest } from "./file-digests.js";
import { viteInlineCssId, ViteCssUrls } from "./vite-css-paths.js";
import { recordViteInput } from "./vite-inputs.js";
import { viteMetadata } from "./vite-metadata.js";
import type { ViteInputs } from "./vite-plugin.js";
import { viteFile } from "./vite-urls.js";

class InlineStylesheet {
  readonly id: string;
  readonly urls: ViteCssUrls;
  readonly reports = new Set<string>();
  classMap: Record<string, string> = {};
  text: string | undefined;

  constructor(
    readonly file: string,
    config: ResolvedConfig,
    private readonly input: ViteInputs,
    stylesheet: string,
  ) {
    this.id = viteInlineCssId(file);
    this.urls = new ViteCssUrls(config, input.paths, stylesheet);
  }

  report = (file: string): void => {
    if (file !== this.file) this.reports.add(file);
  };

  async read(id: string): Promise<void> {
    const file = viteFile(id);
    if (!file || file === this.file) return;
    await recordViteInput(this.input, file);
    this.report(file);
  }
}

/** Only the current inline request can use the native stylesheet hooks. */
export class ViteCssTransform {
  active: InlineStylesheet | undefined;

  forId(id: string): InlineStylesheet | undefined {
    const active = this.active;
    if (active && id.endsWith("?inline") && viteFile(id) === active.file)
      return active;
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
      const reports = new Map<string, string | null>();
      for (const report of [...active.reports].sort()) {
        if (active.urls.owns(report)) continue;
        const file = await input.paths.metadata(report);
        const digest = await metadataDigest(file, {}, input.files.get(file));
        dependencies[input.paths.name(file)] = digest;
        reports.set(file, digest);
      }
      const metadata = await viteMetadata(
        input,
        setupFiles,
        new Set([file, ...active.reports]),
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
