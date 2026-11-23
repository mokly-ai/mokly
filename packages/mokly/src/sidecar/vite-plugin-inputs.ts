import fs from "node:fs/promises";
import path from "node:path";

import type { DevEnvironment, Rollup } from "vite";

import { missingFile } from "./file-digests.js";
import { recordViteInput } from "./vite-inputs.js";
import type { ViteInputs } from "./vite-plugin.js";
import { viteFile, viteId } from "./vite-urls.js";

export function trackVitePluginInputs(
  context: Rollup.PluginContext,
  input: ViteInputs,
  report?: (file: string) => void,
): void {
  const load = context.load.bind(context);
  const watch = context.addWatchFile.bind(context);
  context.addWatchFile = (id) => {
    const file = viteFile(id);
    if (file) {
      let scoped = file;
      try {
        try {
          scoped = input.paths.resolveSync(file);
        } catch (error) {
          if (!missingFile(error)) throw error;
        }
        input.paths.name(scoped);
      } catch {
        input.diagnostic(
          `Skipped plugin input ${path.basename(file)} outside sourceRoot and selected dependency roots`,
        );
        return;
      }
      report?.(scoped);
    }
    watch(id);
  };
  context.load = async (options) => {
    const loaded = await load(options);
    context.addWatchFile(options.id);
    return loaded;
  };
}

export async function recordVitePluginInputs(
  input: ViteInputs,
  environment: DevEnvironment,
  id: string,
  imports: string[],
): Promise<void> {
  const graph = environment.moduleGraph;
  const module = graph.getModuleById(id);
  if (!module) return;
  const codeImports = new Set(
    imports.map(
      (url) =>
        graph.urlToModuleMap.get(url) ?? graph.idToModuleMap.get(viteId(url)),
    ),
  );
  for (const report of module.importedModules) {
    if (codeImports.has(report)) continue;
    const file = viteFile(report.id ?? "");
    if (!file || file === viteFile(id)) continue;
    let confined: string;
    try {
      confined = await input.paths.metadata(file);
    } catch {
      input.diagnostic(
        `Skipped plugin input ${path.basename(file)} outside sourceRoot and selected dependency roots`,
      );
      continue;
    }
    try {
      if (!(await fs.stat(confined)).isFile()) continue;
      await recordViteInput(input, confined);
    } catch (error) {
      if (!missingFile(error)) throw error;
    }
    input.pluginInputs.add(confined);
  }
}
