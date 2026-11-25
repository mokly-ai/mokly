import { build } from "esbuild";

import { definitionData } from "../authoring/runtime.js";
import type { BundleReply } from "../generated/sidecar/BundleReply.js";
import type { CaptureHint } from "../generated/sidecar/CaptureHint.js";
import type { Operation } from "../generated/sidecar/Operation.js";
import type { Request } from "../generated/sidecar/Request.js";

import { bundle } from "./bundle.js";
import type { Generation } from "./bundle.js";
import { CaptureDurability } from "./capture-durability.js";
import { bundleResult, restore, reuse } from "./compiled.js";
import { describe } from "./describe.js";
import { SidecarError, detail, handleLocation, protocol } from "./errors.js";
import { HtmlInput } from "./html_input.js";
import { KeptContext } from "./kept-context.js";
import { finishMarkup } from "./markup.js";
import { unmeasured } from "./measurements.js";
import type { Measurements } from "./measurements.js";
import { PostcssWorkers } from "./postcss.js";
import { checkRecipeSize } from "./recipe-size.js";
import { renderSession } from "./render-session.js";
import { render } from "./render.js";
import { readStorybook } from "./storybook-main.js";
import { ViteCompiler } from "./vite-compiler.js";
import { evaluateVite } from "./vite-evaluate.js";
import { withViteNodePeers } from "./vite-node-peers.js";

export class Session {
  private hello = false;
  private capture: CaptureHint | undefined;
  private generations = new Map<string, Generation>();
  private restored = new WeakSet<Generation>();
  private workers: PostcssWorkers;
  private vite: ViteCompiler;

  constructor(
    private readonly version: string,
    diagnostic: (message: string) => void,
    private readonly compile: typeof build = build,
    private readonly operation: (operation: Operation) => void = () => {},
    private readonly measurements: Measurements = unmeasured,
    phase: (line: string) => void = () => {},
    workers?: PostcssWorkers,
    private readonly checkSize = checkRecipeSize,
    private readonly kept = new KeptContext(),
  ) {
    this.workers =
      workers ?? new PostcssWorkers(diagnostic, operation, undefined, phase);
    this.vite = new ViteCompiler(phase);
  }

  async call(request: Request): Promise<unknown> {
    try {
      const generation =
        "generation" in request.params
          ? this.generations.get(request.params.generation)
          : undefined;
      return await withViteNodePeers(generation, () => this.dispatch(request));
    } catch (error) {
      if (error instanceof SidecarError) throw error;
      const rendering = request.method.startsWith("render");
      const sources =
        "generation" in request.params
          ? this.generations
              .get(request.params.generation)
              ?.params.entryFiles.join(", ")
          : request.method;
      throw new SidecarError(
        rendering ? "render-failed" : "bundle-failed",
        `${sources}: ${detail(error)}`,
      );
    }
  }

  private async dispatch(request: Request): Promise<unknown> {
    if (!this.hello) {
      if (request.method !== "hello")
        protocol("hello must be the first request");
      this.hello = true;
      this.capture = request.params.capture;
      return { version: this.version };
    }
    if (request.method === "hello") protocol("hello already completed");
    switch (request.method) {
      case "readStorybook":
        return readStorybook(request.params);
      case "bundle": {
        const {
          capture = "full",
          plan,
          preparation,
          ...params
        } = request.params;
        try {
          let source: Generation | undefined;
          const previous = await reuse(
            this.generations.values(),
            params,
            capture,
            (candidate) => {
              source = candidate;
            },
          );
          const evidence = previous?.compiled.reuseEvidence;
          if (!previous && params.vite) this.operation("vite");
          const { generation, result } = previous
            ? {
                generation: previous,
                result: bundleResult(
                  previous,
                  undefined,
                  undefined,
                  this.checkSize,
                ),
              }
            : params.vite
              ? await this.vite.bundle(params, this.compile, capture)
              : await bundle(
                  params,
                  (options) => {
                    this.operation("esbuild");
                    return this.compile(options);
                  },
                  this.measurements,
                  capture === "full" && this.capture
                    ? new CaptureDurability(this.capture)
                    : undefined,
                  capture,
                  plan,
                  (options) => {
                    this.operation("esbuild");
                    return this.kept.compile(options);
                  },
                );
          const reply: BundleReply =
            source &&
            this.restored.has(source) &&
            result.compiled.reuseEvidence === evidence &&
            result.plan === undefined
              ? { generation: generation.id, restoredGeneration: source.id }
              : result;
          this.generations.set(generation.id, generation);
          this.restored.delete(generation);
          return reply;
        } catch (error) {
          if (preparation)
            await this.workers.dispose(preparation.context).catch(() => {});
          throw error;
        }
      }
      case "restoreGeneration": {
        const { generation, params, compiled, modules } = request.params;
        if (!this.generations.has(generation)) {
          const installed = restore(params, compiled, modules, generation);
          this.generations.set(generation, installed);
          this.restored.add(installed);
        }
        return null;
      }
      case "describe":
        await evaluateVite(this.generation(request.params.generation));
        return describe(this.generation(request.params.generation));
      case "cssModules": {
        const generation = this.generation(request.params.generation);
        generation.maps = Object.fromEntries(
          Object.entries(request.params.classMaps).map(([file, map]) => [
            file,
            Object.fromEntries(Object.entries(map)),
          ]),
        );
        return null;
      }
      case "bindings": {
        const generation = this.generation(request.params.generation);
        generation.bindings = request.params.entries;
        for (const registration of generation.registrations.values())
          Object.assign(
            registration,
            request.params.entries[registration.handle],
          );
        return null;
      }
      case "renderScreen":
        await evaluateVite(this.generation(request.params.generation));
        return render(
          this.generation(request.params.generation),
          "screen",
          request.params,
        );
      case "renderComponent":
        await evaluateVite(this.generation(request.params.generation));
        return render(
          this.generation(request.params.generation),
          "component",
          request.params,
        );
      case "renderStory":
        await evaluateVite(this.generation(request.params.generation));
        return render(
          this.generation(request.params.generation),
          "story",
          request.params,
        );
      case "renderPage": {
        const generation = this.generation(request.params.generation);
        await evaluateVite(generation);
        const data = definitionData(
          generation.handles.get(request.params.handle),
        )!;
        try {
          const session = renderSession(
            generation,
            {
              viewport: "desktop",
              colorScheme: "light",
            },
            handleLocation(request.params.handle),
          );
          const html = generation.runtime.withSession(session, () =>
            (data.input.render as () => unknown)(),
          );
          if (typeof html !== "string") {
            if (html && typeof html === "object" && "then" in html)
              Promise.resolve(html).catch(() => {});
            throw new Error("page render must synchronously return a string");
          }
          return {
            html: finishMarkup(new HtmlInput(html), session, false).html,
            resources: [],
          };
        } catch (error) {
          throw new SidecarError(
            "render-failed",
            `${handleLocation(request.params.handle)}: ${detail(error)}`,
          );
        }
      }
      case "processCss":
        return this.workers.process(request.params);
      case "transformViteCss":
        return this.vite.stylesheet(request.params, this.compile);
      case "dispose":
        this.generations.delete(request.params.generation);
        return null;
      case "prepareContext":
        this.workers.prepare(request.params);
        return null;
      case "disposeContext":
        await this.workers.dispose(request.params.context);
        return null;
      case "shutdown":
        await this.vite.dispose();
        await this.kept.dispose();
        await this.workers.dispose();
        this.generations.clear();
        return null;
    }
  }

  async dispose(): Promise<void> {
    await this.vite.dispose();
    this.generations.clear();
    await this.kept.dispose();
    await this.workers.dispose();
  }

  private generation(id: string): Generation {
    return this.generations.get(id)!;
  }
}
