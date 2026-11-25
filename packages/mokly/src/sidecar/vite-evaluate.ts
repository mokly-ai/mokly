import { pathToFileURL } from "node:url";

import type * as React from "react";
import type * as ViteRunner from "vite/module-runner";

import { reviewMaterialKey } from "../authoring/data.js";
import { createAuthoring } from "../authoring/definitions.js";
import { AuthoringRuntime } from "../authoring/runtime.js";

import type { BundleExports } from "./bundle-exports.js";
import type { Generation } from "./bundle.js";
import { cssModulePrefix } from "./css-modules.js";
import { SidecarError, detail } from "./errors.js";
import { inside, logical } from "./path-scope.js";
import { wrapStoryUse } from "./story-use.js";
import { viteEvaluationFailure } from "./vite-errors.js";
import { retainViteNodeInputs } from "./vite-node-peers.js";
import { candidateLocation } from "./vite-setup-input.js";
import {
  fetchKey,
  viteEntry,
  viteFile,
  viteId,
  viteName,
} from "./vite-urls.js";

const pending = new WeakMap<Generation, Promise<void>>();

/** Evaluate once from immutable fetches, after the core installs every class map. */
export async function evaluateVite(generation: Generation): Promise<void> {
  if (!generation.compiled.vite || generation.exports) return;
  let evaluation = pending.get(generation);
  if (!evaluation) {
    const sourceRoot = candidateLocation(generation.params.sourceRoot);
    retainViteNodeInputs(generation, sourceRoot);
    evaluation = replay(generation, sourceRoot);
    pending.set(generation, evaluation);
  }
  await evaluation;
}

async function replay(
  generation: Generation,
  sourceRoot: string,
): Promise<void> {
  const recipe = generation.compiled.vite!;
  const names = {
    name(file: string) {
      const index = generation.dependencyRoots.findIndex((root) =>
        inside(root, file),
      );
      if (index >= 0)
        return `node_modules/${index ? `.mokly-roots/${index}/` : ""}${logical(generation.dependencyRoots[index]!, file)}`;
      if (inside(sourceRoot, file)) return logical(sourceRoot, file);
      throw new Error("module is outside sourceRoot");
    },
  };
  const origins = new WeakMap<object, string>();
  const atModule = (error: unknown, id: string): unknown => {
    if (error instanceof SidecarError || viteId(id) === viteEntry) return error;
    const failure = errorObject(error) ? error : new Error(detail(error));
    if (!origins.has(failure))
      origins.set(
        failure,
        viteFile(id) ? viteName(names, id) : "virtual module",
      );
    return failure;
  };
  try {
    const runnerPath = generation.require.resolve("vite/module-runner");
    const {
      ESModulesEvaluator,
      ModuleRunner,
      ssrExportAllKey,
      ssrExportNameKey,
    }: typeof ViteRunner = await import(pathToFileURL(runnerPath).href);
    let react: typeof React | undefined;
    try {
      react = generation.require("react");
    } catch {
      /* Page-only consumers need no React. */
    }
    generation.runtime = new AuthoringRuntime(react);
    const styleAdapters: NonNullable<BundleExports["styleAdapters"]> = {};
    const runtime = {
      authoring: (source?: string) => ({
        ...createAuthoring(generation.runtime, source),
        reviewMaterialKey,
      }),
      css: (file: string) => generation.maps![file],
      storyUse: wrapStoryUse(generation),
      style: (name: keyof typeof styleAdapters, adapter: unknown) => {
        styleAdapters[name] = adapter;
      },
    };
    const classes = new Map<string, Record<string, string>>();
    const cssNamespaces = new Map<unknown, Record<string, string>>();
    for (const file of generation.cssModules) {
      const bindings = generation.viteNamedExports?.[file] ?? {};
      classes.set(generation.runtimeKey + cssModulePrefix + file, bindings);
      cssNamespaces.set(bindings, bindings);
    }
    const base = new ESModulesEvaluator();
    const evaluator: ViteRunner.ModuleEvaluator = {
      startOffset: base.startOffset,
      async runInlinedModule(context, code, module) {
        const exportAll = context[ssrExportAllKey];
        context[ssrExportAllKey] = (source: unknown) => {
          const bindings = cssNamespaces.get(source);
          if (!bindings) return exportAll(source);
          // The runner treats __esModule as an interop marker in export *.
          for (const [name, value] of Object.entries(bindings))
            context[ssrExportNameKey](name, () => value);
        };
        try {
          return await base.runInlinedModule(context, code);
        } catch (error) {
          throw atModule(error, module.id);
        }
      },

      async runExternalModule(file) {
        if (file === generation.runtimeKey) return { default: runtime };
        if (classes.has(file)) return classes.get(file);
        try {
          return await base.runExternalModule(file);
        } catch (error) {
          throw atModule(error, file);
        }
      },
    };
    const records = new Map(
      recipe.modules.map((record) => [
        fetchKey(record.url, record.importer),
        record.result,
      ]),
    );
    const runner = new ModuleRunner(
      {
        hmr: false,
        sourcemapInterceptor: false,
        transport: {
          async invoke(payload) {
            const invocation: unknown =
              payload.type === "custom" ? payload.data : undefined;
            if (
              !invocation ||
              typeof invocation !== "object" ||
              !("name" in invocation)
            )
              throw new SidecarError(
                "bundle-failed",
                "Vite replay: unknown invocation",
              );
            if (invocation.name === "getBuiltins") return { result: [] };
            const args = "data" in invocation ? invocation.data : undefined;
            if (
              invocation.name !== "fetchModule" ||
              !Array.isArray(args) ||
              typeof args[0] !== "string" ||
              (args[1] !== undefined && typeof args[1] !== "string")
            )
              throw new SidecarError(
                "bundle-failed",
                "Vite replay: unknown module request",
              );
            const result = records.get(fetchKey(args[0], args[1]));
            if (!result) {
              const file = viteFile(args[1] ?? args[0]);
              throw new SidecarError(
                "bundle-failed",
                `${file ? names.name(file) : "entry module"}: Vite recipe has no recorded module fetch`,
              );
            }
            return {
              result:
                "code" in result
                  ? { ...result, invalidate: false }
                  : { ...result },
            };
          },
        },
      },
      evaluator,
    );
    const exports = await runner.import<BundleExports>(recipe.entry);
    generation.exports = { ...exports, styleAdapters };
  } catch (error) {
    throw viteEvaluationFailure(
      error,
      names,
      recipe.version,
      errorObject(error) ? origins.get(error) : undefined,
    );
  }
}

function errorObject(error: unknown): error is object {
  return (
    (typeof error === "object" && error !== null) || typeof error === "function"
  );
}
