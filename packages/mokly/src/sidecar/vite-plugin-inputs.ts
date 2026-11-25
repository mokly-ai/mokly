import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { Environment, Plugin, Rollup } from "vite";

import { fileDigest, missingFile } from "./file-digests.js";
import type { ViteInputs } from "./vite-plugin.js";
import { candidateLocation } from "./vite-setup-input.js";
import { viteFile } from "./vite-urls.js";

type Reports = Map<string, string | null>;

interface ModuleReports {
  pendingLoad?: Reports;
  load: Reports;
  transform: Reports;
}

/** Retain the reports of each module while Vite can reuse its transform. */
export class VitePluginReports {
  private readonly skipped = new Set<string>();
  private readonly environments = new WeakMap<
    Environment,
    Map<string, ModuleReports>
  >();

  hooks(current: () => ViteInputs): Pick<Plugin, "load" | "transform"> {
    const reportsFor = this.module.bind(this);
    const track = this.track.bind(this);
    return {
      load: {
        order: "pre",
        handler(id) {
          const reports = reportsFor(this.environment, id);
          const load = new Map<string, string | null>();
          reports.pendingLoad = load;
          track(this, current(), id, load);
        },
      },
      transform: {
        order: "pre",
        handler(_code, id) {
          const reports = reportsFor(this.environment, id);
          reports.load = reports.pendingLoad ?? new Map();
          delete reports.pendingLoad;
          reports.transform = new Map();
          track(this, current(), id, reports.transform, reports.load);
        },
      },
    };
  }

  forModule(environment: Environment, id: string): Reports {
    const reports = this.environments.get(environment)?.get(id);
    return new Map(reports && [...reports.transform, ...reports.load]);
  }

  private module(environment: Environment, id: string): ModuleReports {
    let modules = this.environments.get(environment);
    if (!modules) {
      modules = new Map();
      this.environments.set(environment, modules);
    }
    let reports = modules.get(id);
    if (!reports) {
      reports = { load: new Map(), transform: new Map() };
      modules.set(id, reports);
    }
    return reports;
  }

  private track(
    context: Rollup.PluginContext,
    input: ViteInputs,
    id: string,
    reports: Reports,
    earlier?: Reports,
  ): void {
    const load = context.load.bind(context);
    const watch = context.addWatchFile.bind(context);
    const source = viteFile(id);
    const report = (id: string): boolean => {
      const file = viteFile(id);
      if (!file || file === source) return true;
      const confined = reportFile(input, file);
      if (!confined) return false;
      if (
        confined === source ||
        reports.has(confined) ||
        earlier?.has(confined)
      )
        return true;
      const digest = reportDigest(confined, input.files.get(confined));
      if (digest === undefined) {
        if (!this.skipped.has(confined)) {
          this.skipped.add(confined);
          input.diagnostic(
            `Skipped plugin input ${input.paths.name(confined)} because it is not a regular file. Serve does not watch this path. Add a watch.rules entry with the rebuild action to rebuild after edits below it.`,
          );
        }
        return false;
      }
      reports.set(confined, digest);
      return true;
    };
    context.addWatchFile = (id) => {
      if (report(id)) watch(id);
    };
    context.load = async (options) => {
      const keep = report(options.id);
      const loaded = await load(options);
      if (keep) watch(options.id);
      return loaded;
    };
  }
}

function reportFile(input: ViteInputs, file: string): string | undefined {
  try {
    try {
      return input.paths.resolveSync(file);
    } catch (error) {
      if (!missingFile(error)) throw error;
      return input.paths.location(candidateLocation(file)).file;
    }
  } catch {
    input.diagnostic(
      `Skipped plugin input ${path.basename(file)} outside sourceRoot and selected dependency roots`,
    );
  }
}

function reportDigest(file: string, bytes?: Uint8Array) {
  const kind = fileKind(file);
  if (kind === "other") return undefined;
  if (bytes !== undefined)
    return createHash("sha256").update(bytes).digest("hex");
  if (kind === "absent") return null;
  try {
    const content = fs.readFileSync(file, {
      flag: fs.constants.O_RDONLY | fs.constants.O_NONBLOCK,
    });
    return createHash("sha256").update(content).digest("hex");
  } catch (error) {
    if (missingFile(error)) return null;
    throw error;
  }
}

/** Reclassify a former file candidate if a different kind of path takes its place. */
export async function currentViteReport(
  file: string,
  digest: string | null,
): Promise<boolean> {
  const kind = fileKind(file);
  return kind === "absent"
    ? digest === null
    : kind === "file" && (await fileDigest(file)) === digest;
}

function fileKind(file: string): "file" | "absent" | "other" {
  try {
    const stat = fs.statSync(file, { throwIfNoEntry: false });
    if (!stat) return "absent";
    return stat.isFile() ? "file" : "other";
  } catch (error) {
    if (missingFile(error)) return "absent";
    throw error;
  }
}
