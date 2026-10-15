import { build } from "esbuild";

import { isEntryPath } from "@mokly/viewer/data";

import { definitionData } from "../authoring/runtime.js";
import type { Request } from "../generated/sidecar/Request.js";

import { bundle } from "./bundle.js";
import type { Generation } from "./bundle.js";
import { describe } from "./describe.js";
import { SidecarError, detail, handleLocation, protocol } from "./errors.js";
import { finishMarkup } from "./markup.js";
import { PostcssWorkers } from "./postcss.js";
import { renderSession } from "./render-session.js";
import { render } from "./render.js";

export class Session {
  private hello = false;
  private closed = false;
  private generations = new Map<string, Generation>();
  private workers: PostcssWorkers;

  constructor(
    private readonly version: string,
    diagnostic: (message: string) => void,
    private readonly compile: typeof build = build,
  ) {
    this.workers = new PostcssWorkers(diagnostic);
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
        const { generation, result } = await bundle(
          request.params,
          this.compile,
        );
        if (!this.generations.has(generation.id)) {
          this.generations.set(generation.id, generation);
        }
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
        for (const file of generation.cssModules)
          if (!Object.hasOwn(maps, file))
            throw new SidecarError(
              "bundle-failed",
              `missing CSS Modules map: ${file}`,
            );
        generation.maps = maps;
        return null;
      }
      case "bindings": {
        const generation = this.generation(request.params.generation);
        if (!generation.definitions)
          protocol("describe must complete before bindings");
        const definitions = generation.definitions;
        const handles = new Set(
          [
            ...definitions.screens,
            ...definitions.components,
            ...definitions.pages,
            ...definitions.useCases,
            ...definitions.folders,
          ].map((definition) => definition.handle),
        );
        if (
          [...handles].some(
            (handle) => !Object.hasOwn(request.params.entries, handle),
          ) ||
          Object.keys(request.params.entries).some(
            (handle) => !handles.has(handle),
          )
        )
          protocol("bindings must contain every described handle exactly once");
        const folders = new Set(
          definitions.folders.map((folder) => folder.handle),
        );
        for (const [handle, entry] of Object.entries(request.params.entries))
          if (
            !isEntryPath(entry.path) &&
            !(entry.path === "" && folders.has(handle))
          )
            protocol("bindings require complete catalogue paths");
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
        const definitions = await describe(generation);
        if (definitions.diagnostics.length)
          throw new SidecarError(
            definitions.diagnostics[0]!.code,
            definitions.diagnostics[0]!.message,
          );
        if (!generation.bindings)
          throw new SidecarError(
            "bundle-failed",
            "bindings must install the resolved handle table before rendering",
          );
        const data = definitionData(
          generation.handles.get(request.params.handle),
        );
        try {
          if (!data || data.kind !== "page")
            throw new Error("unknown page handle");
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
            warnings: [],
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
