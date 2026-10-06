/** A controllable live generation with real previews and exhaustive usage. */
import path from "node:path";

import {
  compileCatalogue,
  type Compilation,
} from "../../packages/mokly/dist/build/compile.js";
import type { ComponentRuntime } from "../../packages/mokly/dist/build/component_runtime.js";
import { prepareLiveRuntime } from "../../packages/mokly/dist/build/live_runtime.js";
import { loadConfig } from "../../packages/mokly/dist/config/load.js";
import { startCatalogueServer } from "../../packages/mokly/dist/server/http.js";
import type { RunningServer } from "../../packages/mokly/dist/server/http_types.js";

import {
  createFixture,
  removeFixture,
  reparentedEntrySource,
} from "./fixture.js";

type StartEvidenceFixtureResult = {
  server: RunningServer;
  runtime: ComponentRuntime;
  compilation: Compilation;
  readonly comparisonRequests: number;
  close(): Promise<void>;
};

export async function startEvidenceFixture(
  source = reparentedEntrySource("screens"),
): Promise<StartEvidenceFixtureResult> {
  const fixture = await createFixture(source, {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  try {
    const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
    const compilation = await compileCatalogue(runtime.config);
    let comparisonRequests = 0;
    const server = await startCatalogueServer(runtime.config, {
      base: "main",
      port: 0,
      manifest: runtime.manifest,
      componentRuntime: runtime,
      changesStatus: "pending",
      review: {
        base: "main",
        outDir: path.join(fixture.root, ".review"),
        generate: async () => {
          comparisonRequests++;
          throw new Error("Comparisons are not requested by this fixture");
        },
      },
    });
    return {
      server,
      runtime,
      compilation,
      get comparisonRequests() {
        return comparisonRequests;
      },
      async close() {
        await server.close();
        await removeFixture(fixture);
      },
    };
  } catch (error) {
    await removeFixture(fixture);
    throw error;
  }
}
