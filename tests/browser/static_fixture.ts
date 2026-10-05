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
  renamedId: string,
): string {
  const page = (id: string, title: string) =>
    `definePage({ dependencies: [], description: ${JSON.stringify(`${title} guidance`)}, path: ${JSON.stringify(id)}, relatedDocs: [], render: () => ${JSON.stringify(`<!doctype html><html><body><h1>${title}</h1></body></html>`)}, title: ${JSON.stringify(title)} })`;
  return `import { definePage } from "@mokly/mokly";
export const mockups = [
  ${includeRemoved ? `${page("removed", "Removed")},` : ""}
  ${page(renamedId, "Renamed")}
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
          .replace('path: "home",', 'tags: ["forms"], path: "home",');
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
      await assertServedShellMarker(server.url, "/view/home/");
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

/** Finalized export containing a removed page and a paired moved page. */
export async function startHistoricalStaticFixture() {
  const fixture = await createExportFixture(
    historicalEntrySource(true, "renamed-old"),
  );
  const isolated = await fs.promises.mkdtemp(
    path.join(repositoryRoot, ".context/mokly-static-history-"),
  );
  try {
    await fs.promises.writeFile(
      fixture.entryPath,
      historicalEntrySource(false, "renamed"),
    );
    await exportCatalogue(fixture.config, {
      outDir: "site",
    });
    await fs.promises.cp(fixture.output, isolated, { recursive: true });
    await fixture.close();
    const server = await serveStaticFiles(isolated);
    try {
      await assertServedShellMarker(server.url, "/view/removed/");
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
