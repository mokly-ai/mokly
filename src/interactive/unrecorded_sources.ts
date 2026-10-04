/** Guard unrecorded file loads without another resolution pass on healthy builds. */

import type { OnResolveArgs, PluginBuild } from "esbuild";

import { resolveInteractiveSourceRequest } from "../build/interactive_source_resolution.js";

import { LiveSourceLocations } from "./source_locations.js";

/** Cache ownership and retain request provenance for typed missing-source errors. */
export class UnrecordedSourceGuard {
  readonly locations: LiveSourceLocations;
  private readonly requests: OnResolveArgs[] = [];

  constructor(repoRoot: string) {
    this.locations = new LiveSourceLocations(repoRoot);
  }

  /** Save only requests whose normal file resolution can reach an owned source. */
  record(arguments_: OnResolveArgs): void {
    if (arguments_.namespace === "file") this.requests.push(arguments_);
  }

  /** Find the incoming importer only after a repository load has been refused. */
  async importer(
    candidate: string,
    pluginBuild: PluginBuild,
    skipResolution: object,
  ): Promise<string> {
    for (let index = this.requests.length - 1; index >= 0; index--) {
      const request = this.requests[index]!;
      const resolved = await resolveInteractiveSourceRequest(
        pluginBuild,
        request,
        skipResolution,
      );
      if (resolved.namespace === "file" && resolved.path === candidate)
        return request.importer;
    }
    return "";
  }
}
