import { build } from "esbuild";

import { definitionData } from "../authoring/runtime.js";
import type { Operation } from "../generated/sidecar/Operation.js";
import type { Request } from "../generated/sidecar/Request.js";

import { bundle } from "./bundle.js";
import type { Generation } from "./bundle.js";
import { bundleResult, restore, reuse } from "./compiled.js";
import { describe } from "./describe.js";
import { SidecarError, detail, handleLocation, protocol } from "./errors.js";
import { finishMarkup } from "./markup.js";
import { unmeasured } from "./measurements.js";
import type { Measurements } from "./measurements.js";
import { PostcssWorkers } from "./postcss.js";
import { renderSession } from "./render-session.js";
import { render } from "./render.js";

export class Session {
  private hello = false;
  private generations = new Map<string, Generation>();
  private workers: PostcssWorkers;

  constructor(
    private readonly version: string,
    diagnostic: (message: string) => void,
    private readonly compile: typeof build = build,
    private readonly operation: (operation: Operation) => void = () => {},
    private readonly measurements: Measurements = unmeasured,
    phase: (line: string) => void = () => {},
  ) {
    this.workers = new PostcssWorkers(diagnostic, operation, undefined, phase);
  }

  async call(request: Request): Promise<unknown> {
    try {
      return await this.dispatch(request);
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
      return { version: this.version };
    }
    if (request.method === "hello") protocol("hello already completed");
    switch (request.method) {
      case "bundle": {
        const previous = await reuse(this.generations.values(), request.params);
        const { generation, result } = previous
          ? { generation: previous, result: bundleResult(previous) }
          : await bundle(
              request.params,
              (options) => {
                this.operation("esbuild");
                return this.compile(options);
              },
              this.measurements,
            );
        this.generations.set(generation.id, generation);
        return result;
      }
      case "restoreGeneration": {
        const { generation, params, compiled, modules } = request.params;
        if (!this.generations.has(generation))
          this.generations.set(
            generation,
            restore(params, compiled, modules, generation),
          );
        return null;
      }
      case "describe":
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
        return render(
          this.generation(request.params.generation),
          "screen",
          request.params,
        );
      case "renderComponent":
        return render(
          this.generation(request.params.generation),
          "component",
          request.params,
        );
      case "renderStory":
        return render(
          this.generation(request.params.generation),
          "story",
          request.params,
        );
      case "renderPage": {
        const generation = this.generation(request.params.generation);
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
            html: finishMarkup(html, session, false).html,
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
      case "dispose":
        this.generations.delete(request.params.generation);
        return null;
      case "disposeContext":
        await this.workers.dispose(request.params.context);
        return null;
      case "shutdown":
        await this.workers.dispose();
        this.generations.clear();
        return null;
    }
  }

  async dispose(): Promise<void> {
    this.generations.clear();
    await this.workers.dispose();
  }

  private generation(id: string): Generation {
    return this.generations.get(id)!;
  }
}
