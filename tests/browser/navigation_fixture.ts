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

/** Build and serve the navigation/security browser fixture. */
export async function startNavigationFixture(): Promise<NavigationFixture> {
  const fixture = await createFixture(navigationSource(), {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  const legacy = path.join(fixture.root, "legacy");
  await fs.promises.mkdir(legacy);
  await fs.promises.writeFile(
    path.join(legacy, "guide.source.ts"),
    `export const source = () => '<!doctype html><html><body><a id="legacy-link" href="mock:details#section">Details</a></body></html>';\n`,
  );
  await fs.promises.mkdir(path.join(fixture.mockupsDir, "screens"));
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "screens", "nested.html"),
    `<!doctype html><html><head><base target="_top"></head><body><div id="local"></div><a id="local-base" href="#local">Base-targeted</a><a id="local-unmarked" href="#local" target="_top">Local</a><a data-mokly-link="details" href="./details.mobile.html" id="local-marked" target="_top">Marked-looking</a></body></html>`,
  );
  await fs.promises.writeFile(
    fixture.configPath,
    `export default { colorSchemes: ["light", "dark"], entriesDir: "entries",  mockupsDir: "mockups", repoRoot: "." };\n`,
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
      schemaVersion: 1,
      baseRef: "origin/main",
      baseCommit: "a".repeat(40),
      changedRoutes: [
        "screens/extra.html",
        "screens/home.html",
        "screens/home.variants/error.html",
        "user-flows/tour.html",
      ],
      removedEntries: [],
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
  return `import { defineCollection, defineScreen, defineUseCase, MockLink } from "@mokly/mokly";
import React from "react";
const metadata = { dependencies: [], relatedDocs: [] };
function Home({ compact }) {
  const nestedGenerated = compact ? "./details.mobile.html" : "./details.desktop.html";
  return <main id="home">
    {compact ? <MockLink fragment="section" id="mock-link" to="details">MockLink details</MockLink> : <a href="mock:details#section" id="raw-link">Raw details</a>}
    <map name="destinations"><area href="mock:details#section" id="area-link" shape="default" /></map>
    <svg viewBox="0 0 100 30"><a href="mock:details#section" id="svg-link"><text x="0" y="20">SVG details</text></a></svg>
    <a href="mock:details#section" id="blank-link" target="_blank">Blank details</a>
    <a href="mock:details#section" id="named-link" target="DetailsFrame">Named details</a>
    <a href="mock:details#section" id="top-link" target="_top">Top details</a>
    <a href="mock:details#section" id="parent-link" target="_parent">Parent details</a>
    <a href="#home" id="unmarked-top" target="_top">Ordinary top</a>
    <a href="#home" id="unmarked-parent" target="_parent">Ordinary parent</a>
    <svg viewBox="0 0 100 30"><a href="#home" id="unmarked-svg-top" target="_top"><text x="0" y="20">Ordinary SVG</text></a></svg>
    <a href="https://cross-origin.example.test/nested.html" id="external-self">External</a>
    <a download="fixture.txt" href="data:text/plain,fixture" id="download-top" target="_top">Download</a>
    <form action="#home" id="top-form" target="_top"><button type="submit">Submit</button></form>
    <script>window.__consumerScriptRan = true;</script>
    <iframe id="srcdoc-nested" srcDoc={'<a data-mokly-link="details#section" href="./details.mobile.html" id="srcdoc-marked" target="_top">Marked</a><a href="#ordinary" id="srcdoc-unmarked" target="_top">Ordinary</a><a href="#popup" id="srcdoc-popup" target="_blank">Popup</a><script>parent.__nestedScriptRan=true</script>'} title="srcdoc nested" />
    <iframe id="local-nested" src="./nested.html" title="local nested" />
    <iframe id="generated-nested" src={nestedGenerated} title="generated nested" />
    <iframe id="cross-nested" src="https://cross-origin.example.test/nested.html" title="cross-origin nested" />
  </main>;
}
function Details() {
  return <main id="section"><h1>Details destination</h1><a href="mock:home" id="return-link">Return home</a></main>;
}
export const mockups = [
  defineCollection({ ...metadata, childIds: ["nested"], description: "Fixture", id: "fixture", title: "Fixture" }),
  defineCollection({ ...metadata, childIds: ["home", "details", "tour"], description: "Nested", id: "nested", title: "Nested" }),
  defineCollection({ ...metadata, childIds: ["extra"], description: "Other", id: "other", title: "Other" }),
  defineScreen({ ...metadata, description: "Home", desktop: <Home compact={false} />, id: "home", mobile: <Home compact />, route: "screens/home.html", title: "Home", useCaseIds: ["tour"], variants: [
    { description: "Home before any workspace exists", desktop: <main id="home-empty">Empty workspace</main>, id: "home-empty", mobile: <main id="home-empty">Empty workspace</main>, slug: "empty", title: "Empty workspace" },
    { description: "Home after saving failed", desktop: <main id="home-error">Save failed</main>, id: "home-error", mobile: <main id="home-error">Save failed</main>, slug: "error", title: "Save failed" },
  ] }),
  defineScreen({ ...metadata, description: "Details", desktop: <Details />, id: "details", mobile: <Details />, route: "screens/details.html", title: "Details", useCaseIds: ["tour"] }),
  defineScreen({ ...metadata, description: "Extra", desktop: <main>Extra</main>, id: "extra", mobile: <main>Extra</main>, route: "screens/extra.html", title: "Extra", useCaseIds: [] }),
  defineUseCase({ ...metadata, description: "Tour", id: "tour", route: "user-flows/tour.html", steps: [{ screenId: "home" }, { screenId: "details" }], title: "Tour" })
];
`;
}
