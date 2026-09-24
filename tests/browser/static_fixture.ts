import fs from "node:fs";
import path from "node:path";

import { exportCatalogue } from "../../dist/export/run.js";
import { comparisonEntrySource } from "../helpers/comparison_source.js";
import {
  createExportFixture,
  directoryFiles,
} from "../helpers/export_fixture.js";
import { repositoryRoot, validEntrySource } from "../helpers/fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

import { assertServedShellMarker } from "./export_shell.js";

interface StaticFixtureOptions {
  comparisons?: boolean;
  noChanges?: boolean;
}

function historicalEntrySource(
  includeRemoved: boolean,
  renamedRoute: string,
): string {
  const page = (id: string, route: string, title: string) =>
    `definePage({ description: ${JSON.stringify(`${title} guidance`)}, id: ${JSON.stringify(id)}, relatedDocs: [], render: () => ${JSON.stringify(`<!doctype html><html><body><h1>${title}</h1></body></html>`)}, route: ${JSON.stringify(route)}, title: ${JSON.stringify(title)} })`;
  return `import { definePage } from "@mokly/mokly";
export const mockups = [
  ${includeRemoved ? `${page("removed", "removed.html", "Removed")},` : ""}
  ${page("renamed", renamedRoute, "Renamed")}
];
`;
}

/** Export an independent consumer, then remove its entire source/Git repository. */
export async function startStaticFixture({
  comparisons = false,
  noChanges = false,
}: StaticFixtureOptions = {}) {
  const source = (changed: boolean) =>
    comparisons
      ? comparisonEntrySource(changed).replaceAll(
          "<main>Details</main>",
          `<main>${changed ? "Current" : "Previous"} details</main>`,
        )
      : validEntrySource({
          body: `<h1>${changed ? "Current" : "Previous"} home</h1><a href="mock:details#details">Details</a><a href="mock:details#details" target="_blank">New tab</a><a href="mock:details#details" target="reference">Named tab</a>`,
        })
          .replace('id="details-mobile"', 'id="details"')
          .replace('id: "home",', 'tags: ["forms"], id: "home",');
  const fixture = await createExportFixture(source(false), {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  const isolated = await fs.promises.mkdtemp(
    path.join(repositoryRoot, ".context/mokly-static-"),
  );
  try {
    await fs.promises.writeFile(fixture.entryPath, source(true));
    await exportCatalogue(fixture.config, {
      outDir: "site",
      noChanges,
    });
    await fs.promises.cp(fixture.output, isolated, { recursive: true });
    await fixture.close();
    const files = await directoryFiles(isolated);
    const server = await serveStaticFiles(isolated);
    try {
      await assertServedShellMarker(server.url, "/view/screens/home.html");
    } catch (error) {
      await server.close();
      throw error;
    }
    return {
      ...server,
      root: isolated,
      files,
      close: async () => {
        await server.close();
        await fs.promises.rm(isolated, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await fixture.close();
    await fs.promises.rm(isolated, { recursive: true, force: true });
    throw error;
  }
}

/** Finalized export containing both removed and renamed historical routes. */
export async function startHistoricalStaticFixture() {
  const fixture = await createExportFixture(
    historicalEntrySource(true, "guides/original.html"),
  );
  const isolated = await fs.promises.mkdtemp(
    path.join(repositoryRoot, ".context/mokly-static-history-"),
  );
  try {
    await fs.promises.writeFile(
      fixture.entryPath,
      historicalEntrySource(false, "guides/renamed.html"),
    );
    await exportCatalogue(fixture.config, {
      outDir: "site",
    });
    await fs.promises.cp(fixture.output, isolated, { recursive: true });
    await fixture.close();
    const server = await serveStaticFiles(isolated);
    try {
      await assertServedShellMarker(server.url, "/view/removed.html");
    } catch (error) {
      await server.close();
      throw error;
    }
    return {
      ...server,
      close: async () => {
        await server.close();
        await fs.promises.rm(isolated, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await fixture.close();
    await fs.promises.rm(isolated, { recursive: true, force: true });
    throw error;
  }
}
