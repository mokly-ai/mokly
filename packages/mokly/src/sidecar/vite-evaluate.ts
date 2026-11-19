import { pathToFileURL } from "node:url";

import type * as React from "react";
import type * as ViteRunner from "vite/module-runner";

import { reviewMaterialKey } from "../authoring/data.js";
import { createAuthoring } from "../authoring/definitions.js";
import { AuthoringRuntime } from "../authoring/runtime.js";

import type { BundleExports, Generation } from "./bundle.js";
import { cssModulePrefix, namedClasses } from "./css-modules.js";
import { SidecarError } from "./errors.js";
import { inside, logical } from "./path-scope.js";
import { viteFailure } from "./vite-errors.js";
import { fetchKey, viteFile } from "./vite-urls.js";

const pending = new WeakMap<Generation, Promise<void>>();

/** Evaluate once from immutable fetches, after the core installs every class map. */
export async function evaluateVite(generation: Generation): Promise<void> {
  if (!generation.compiled.vite || generation.exports) return;
  let evaluation = pending.get(generation);
  if (!evaluation) {
    evaluation = replay(generation);
    pending.set(generation, evaluation);
  }
  await evaluation;
}

async function replay(generation: Generation): Promise<void> {
  const recipe = generation.compiled.vite!;
  const names = {
    name(file: string) {
      const index = generation.dependencyRoots.findIndex((root) =>
        inside(root, file),
      );
      if (index >= 0)
        return `node_modules/${index ? `.mokly-roots/${index}/` : ""}${logical(generation.dependencyRoots[index]!, file)}`;
      if (inside(generation.params.sourceRoot, file))
        return logical(generation.params.sourceRoot, file);
      throw new Error("module is outside sourceRoot");
    },
  };
  try {
    const runnerPath = generation.require.resolve("vite/module-runner");
    const { ESModulesEvaluator, ModuleRunner }: typeof ViteRunner =
      await import(pathToFileURL(runnerPath).href);
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
      style: (name: keyof typeof styleAdapters, adapter: unknown) => {
        styleAdapters[name] = adapter;
      },
    };
    const classes = new Map(
      [...generation.cssModules].map((file) => [
        generation.runtimeKey + cssModulePrefix + file,
        namedClasses(generation.maps![file]!),
      ]),
    );
    class Evaluator extends ESModulesEvaluator {
      override async runExternalModule(file: string): Promise<unknown> {
        if (file === generation.runtimeKey) return { default: runtime };
        if (classes.has(file)) return classes.get(file);
        return super.runExternalModule(file);
      }
    }
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
      new Evaluator(),
    );
    const exports = await runner.import<BundleExports>(recipe.entry);
    generation.exports = { ...exports, styleAdapters };
  } catch (error) {
    throw viteFailure(
      error,
      names,
      generation.params.entryFiles[0]
        ? generation.params.sourceRoot + "/" + generation.params.entryFiles[0]
        : "",
      recipe.version,
    );
  }
}
