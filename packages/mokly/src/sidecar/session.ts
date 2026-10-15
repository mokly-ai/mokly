import { definitionData } from "../authoring/runtime.js";
import type { Request } from "../generated/sidecar/Request.js";

import { bundle } from "./bundle.js";
import type { Generation } from "./bundle.js";
import { describe } from "./describe.js";
import { SidecarError, detail, protocol } from "./errors.js";
import { finishMarkup } from "./markup.js";
import { PostcssWorkers } from "./postcss.js";
import { renderSession } from "./render-session.js";
import { render } from "./render.js";

export class Session {
  private hello = false;
  private closed = false;
  private generations = new Map<string, Generation>();
  private workers: PostcssWorkers;
  private root: string;

  constructor(
    private readonly version: string,
    diagnostic: (message: string) => void,
    root: string,
  ) {
    this.workers = new PostcssWorkers(diagnostic);
    this.root = root;
  }

  async call(request: Request): Promise<unknown> {
    if (this.closed) protocol("session is closed");
    if (!this.hello) {
      if (request.method !== "hello")
        protocol("hello must be the first request");
      this.hello = true;
      return { version: this.version };
    }
    if (request.method === "hello") protocol("hello already completed");
    switch (request.method) {
      case "bundle": {
        const { generation, result } = await bundle(request.params);
        if (!this.generations.has(generation.id)) {
          await this.workers.dispose();
          this.generations.set(generation.id, generation);
        }
        this.root = generation.params.sourceRoot;
        return result;
      }
      case "describe":
        return describe(this.generation(request.params.generation));
      case "cssModules": {
        const generation = this.generation(request.params.generation);
        if (generation.exports)
          protocol("CSS Modules maps cannot change after evaluation");
        const maps = Object.fromEntries(
          Object.entries(request.params.classMaps).map(([file, map]) => [
            file,
            Object.fromEntries(Object.entries(map)),
          ]),
        );
        if (generation.cssModules.size) {
          const compiled = await bundle(generation.params, maps);
          if (compiled.generation.id !== generation.id)
            throw new SidecarError(
              "bundle-failed",
              "generation changed while installing CSS Modules maps",
            );
          generation.code = compiled.generation.code;
          generation.runtimeKey = compiled.generation.runtimeKey;
        }
        generation.maps = maps;
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
        const definitions = await describe(generation);
        if (definitions.diagnostics.length)
          throw new SidecarError(
            definitions.diagnostics[0]!.code,
            definitions.diagnostics[0]!.message,
          );
        const data = definitionData(
          generation.handles.get(request.params.handle),
        );
        try {
          if (!data || data.kind !== "page")
            throw new Error("unknown page handle");
          const session = renderSession(generation, {
            viewport: "desktop",
            colorScheme: "light",
          });
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
            warnings: generation.warnings,
          };
        } catch (error) {
          throw new SidecarError(
            "render-failed",
            `${request.params.handle}: ${detail(error)}`,
          );
        }
      }
      case "processCss":
        return this.workers.process(request.params, this.root);
      case "dispose":
        this.generations.delete(request.params.generation);
        await this.workers.dispose();
        return null;
      case "shutdown":
        this.closed = true;
        await this.workers.dispose();
        this.generations.clear();
        return null;
    }
  }

  async dispose(): Promise<void> {
    this.closed = true;
    this.generations.clear();
    await this.workers.dispose();
  }

  private generation(id: string): Generation {
    const generation = this.generations.get(id);
    if (!generation)
      throw new SidecarError("bundle-failed", `unknown generation ${id}`);
    return generation;
  }
}
