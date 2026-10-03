import fs from "node:fs";
import path from "node:path";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import { loadCatalogueSnapshot } from "../../dist/server/catalogue_snapshot.js";
import { startCatalogueServer } from "../../dist/server/http.js";
import {
  registerFixturePage,
  createFixture,
  removeFixture,
  type TestFixture,
} from "../helpers/fixture.js";

/** One isolated catalogue used by the in-frame navigation browser suite. */
export interface NavigationFixture {
  fixture: TestFixture;
  url: string;
  close(): Promise<void>;
}

/**
 * A variant of Home deleted on this branch. Its retained `variantOf` keeps the
 * Removed row inside the surviving parent's list instead of at the root.
 */
const REMOVED_HOME_VARIANT = {
  folderTitles: ["Fixture", "Nested"],
  entry: {
    declaredDependencies: [],
    description: "Home after the workspace was deleted",
    colorSchemes: ["light" as const],
    path: "fixture/nested/home/gone",
    kind: "screen" as const,

    relatedDocs: [],
    sourcePath: "entries/fixture.mockup.tsx",
    title: "Workspace deleted",
    useCasePaths: [],
    variantOf: "fixture/nested/home",
  },
};

/** Build and serve the navigation/security browser fixture. */
export async function startNavigationFixture(): Promise<NavigationFixture> {
  const fixture = await createFixture(navigationSource(), {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  const legacy = path.join(fixture.root, "legacy");
  await fs.promises.mkdir(legacy);
  await fs.promises.writeFile(
    path.join(legacy, "guide.source.ts"),
    `export const source = () => '<!doctype html><html><body><a id="legacy-link" href="mock:fixture/nested/details#section">Details</a></body></html>';\n`,
  );
  await fs.promises.mkdir(
    path.join(fixture.mockupsDir, "fixture/nested/home"),
    { recursive: true },
  );
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "fixture/nested/home", "nested.html"),
    `<!doctype html><html><head><base target="_top"></head><body><div id="local"></div><a id="local-base" href="#local">Base-targeted</a><a id="local-unmarked" href="#local" target="_top">Local</a><a data-mokly-link="fixture/nested/details" href="../details/index.mobile.html" id="local-marked" target="_top">Marked-looking</a></body></html>`,
  );
  for (const viewport of ["desktop", "mobile"])
    await fs.promises.writeFile(
      path.join(fixture.mockupsDir, `slow-navigation-${viewport}.svg`),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" />',
    );
  await fs.promises.writeFile(
    fixture.configPath,
    `export default { colorSchemes: ["light", "dark"], roots: [{ dir: "entries" }],  mockupsDir: "mockups", repoRoot: "." };\n`,
  );
  await registerFixturePage(
    fixture,
    "guide",
    "guide.html",
    "legacy/guide.source.ts",
  );
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const server = await startCatalogueServer(config, {
    base: "origin/main",
    snapshot: await loadCatalogueSnapshot(config, async () => ({
      movedEntries: [],
      schemaVersion: 2,
      baseRef: "origin/main",
      baseCommit: "a".repeat(40),
      changedEntries: [
        "other/extra",
        "fixture/nested/home/error",
        "fixture/nested/home/gone",
        "fixture/nested/tour",
      ],
      removedEntries: [REMOVED_HOME_VARIANT],
    })),
    port: 0,
  });
  return {
    async close(): Promise<void> {
      await server.close();
      await removeFixture(fixture);
    },
    fixture,
    url: server.url,
  };
}

function navigationSource(): string {
  return `import { defineScreen, defineUseCase, MockLink } from "@mokly/mokly";
import React from "react";
const metadata = { dependencies: [], relatedDocs: [] };
function Home({ compact }) {
  const nestedGenerated = compact ? "../details/index.mobile.html" : "../details/index.desktop.html";
  return <main id="home">
    <img alt="" src={compact ? "../../../slow-navigation-mobile.svg" : "../../../slow-navigation-desktop.svg"} />
    {compact ? <MockLink fragment="section" id="mock-link" to="fixture/nested/details">MockLink details</MockLink> : <a href="mock:fixture/nested/details#section" id="raw-link">Raw details</a>}
    <map name="destinations"><area href="mock:fixture/nested/details#section" id="area-link" shape="default" /></map>
    <svg viewBox="0 0 100 30"><a href="mock:fixture/nested/details#section" id="svg-link"><text x="0" y="20">SVG details</text></a></svg>
    <a href="mock:fixture/nested/details#section" id="blank-link" target="_blank">Blank details</a>
    <a href="mock:fixture/nested/details#section" id="named-link" target="DetailsFrame">Named details</a>
    <a href="mock:fixture/nested/details#section" id="top-link" target="_top">Top details</a>
    <a href="mock:fixture/nested/details#section" id="parent-link" target="_parent">Parent details</a>
    <a href="../details/index.mobile.html" id="unowned-details-link">Unowned details</a>
    <a href="./index.mobile.dark.html" id="unowned-next-scheme-link">Unowned next scheme</a>
    <a href="#home" id="unmarked-top" target="_top">Ordinary top</a>
    <a href="#home" id="unmarked-parent" target="_parent">Ordinary parent</a>
    <svg viewBox="0 0 100 30"><a href="#home" id="unmarked-svg-top" target="_top"><text x="0" y="20">Ordinary SVG</text></a></svg>
    <a href="https://cross-origin.example.test/nested.html" id="external-self">External</a>
    <a download="fixture.txt" href="data:text/plain,fixture" id="download-top" target="_top">Download</a>
    <form action="#home" id="top-form" target="_top"><button type="submit">Submit</button></form>
    <script>window.__consumerScriptRan = true;</script>
    <iframe id="srcdoc-nested" srcDoc={'<a data-mokly-link="fixture/nested/details#section" href="../details/index.mobile.html" id="srcdoc-marked" target="_top">Marked</a><a href="#ordinary" id="srcdoc-unmarked" target="_top">Ordinary</a><a href="#popup" id="srcdoc-popup" target="_blank">Popup</a><script>parent.__nestedScriptRan=true</script>'} title="srcdoc nested" />
    <iframe id="local-nested" src="./nested.html" title="local nested" />
    <iframe id="generated-nested" src={nestedGenerated} title="generated nested" />
    <iframe id="cross-nested" src="https://cross-origin.example.test/nested.html" title="cross-origin nested" />
  </main>;
}
function Details() {
  return <main id="section"><h1>Details destination</h1><a href="mock:fixture/nested/home" id="return-link">Return home</a><a href="mock:other/extra" id="extra-link">Extra</a></main>;
}
export const mockups = [
  ...defineScreen({ ...metadata, description: "Home", desktop: <Home compact={false} />, path: "fixture/nested/home", mobile: <Home compact />, title: "Home", useCasePaths: ["fixture/nested/tour"], variants: [
    { description: "Home before any workspace exists", desktop: <main id="home-empty">Empty workspace</main>,  mobile: <main id="home-empty">Empty workspace</main>, slug: "empty", title: "Empty workspace" },
    { description: "Home after saving failed", desktop: <main id="home-error">Save failed</main>,  mobile: <main id="home-error">Save failed</main>, slug: "error", title: "Save failed" },
  ] }),
  defineScreen({ ...metadata, description: "Details", desktop: <Details />, path: "fixture/nested/details", mobile: <Details />, title: "Details", useCasePaths: ["fixture/nested/tour"] }),
  defineScreen({ ...metadata, description: "Extra", desktop: <main>Extra</main>, path: "other/extra", mobile: <main>Extra</main>, title: "Extra", useCasePaths: [] }),
  defineUseCase({ ...metadata, description: "Tour", path: "fixture/nested/tour", steps: [{ screenPath: "fixture/nested/home" }, { screenPath: "fixture/nested/details" }], title: "Tour" })
];
`;
}
