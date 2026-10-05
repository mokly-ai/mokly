import fs from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { prepareLiveRuntime } from "../../dist/build/live_runtime.js";
import { loadConfig } from "../../dist/config/load.js";
import { startCatalogueServer } from "../../dist/server/http.js";
import { createFixture } from "../helpers/fixture.js";

import {
  mountInteractiveFrame,
  type InteractiveTestWindow,
} from "./interactive_fixture.js";

const source = `import React, { useState } from "react";
import { defineScreen, defineComponent, MockLink, mockLink } from "@mokly/mokly";
const metadata = { dependencies: [], relatedDocs: [], description: "Paths" };
export const details = defineScreen({ ...metadata, slug: "Details", title: "Details", mobile: "Details", desktop: "Details" });
const definitionLink = mockLink(details);
function Action() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>Count {count}</button>;
}
export const action = defineComponent({ ...metadata, path: "Components/Action", title: "Action", propSchema: { kind: "object", properties: {} }, render: Action, variants: [{ slug: "Default", title: "Default", props: {} }] });
function Home() {
  return <main>
    <action.Component />
    <MockLink to="./Details">Relative details</MockLink>
    <MockLink to={details}>Definition details</MockLink>
    <a href={definitionLink}>Raw definition</a>
    <a href="mock:./Guide">Markdown guide</a>
  </main>;
}
export default defineScreen({ ...metadata, title: "Home", mobile: <Home />, desktop: <Home />, variants: [{ slug: "Empty", title: "Empty", description: "Empty", mobile: <Home />, desktop: <Home /> }] });
`;

test("Live preserves file paths, root rules, variants, definition links and Markdown links", async ({
  page,
}) => {
  const fixture = await createFixture(source, {
    extraConfig:
      'interactive: "serve", roots: [{ dir: "entries", path: "Product", transparent: ["parts"] }],',
  });
  try {
    const directory = path.join(fixture.entriesDir, "Account", "parts");
    await fs.mkdir(directory, { recursive: true });
    await fs.rename(
      fixture.entryPath,
      path.join(directory, "index.mockup.tsx"),
    );
    await fs.writeFile(path.join(directory, "Guide.md"), "# Account guide\n");
    const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
    const diagnostics: unknown[] = [];
    const server = await startCatalogueServer(runtime.config, {
      base: "main",
      changesStatus: "unavailable",
      componentRuntime: runtime,
      manifest: runtime.manifest,
      onDiagnostic: (error) => diagnostics.push(error),
      port: 0,
    });
    fixture.beforeRemove(() => server.close());
    const prepared = await fetch(
      `${server.url}/__mokly/interactive/${runtime.generation}/prepare`,
      {
        method: "POST",
        headers: { origin: server.url },
      },
    );
    expect(prepared.status).toBe(200);
    expect(server.interactiveOrigin).toBeDefined();
    for (const entryPath of ["Product/Account", "Product/Account/Empty"]) {
      const livePath = `/static/${entryPath}/index.mobile.html`;
      await mountInteractiveFrame(page, {
        host: { url: server.url },
        frames: { url: server.interactiveOrigin! },
        livePath,
      });
      const frame = page.frameLocator("#frame");
      await frame.getByRole("button", { name: "Count 0" }).click();
      await expect(
        frame.getByRole("button", { name: "Count 1" }),
      ).toBeVisible();
      for (const name of [
        "Relative details",
        "Definition details",
        "Raw definition",
        "Markdown guide",
      ])
        await frame.getByRole("link", { name, exact: true }).click();
      await expect
        .poll(() =>
          page.evaluate(() =>
            (window as unknown as InteractiveTestWindow).frameEvents.flatMap(
              (event) =>
                event.type === "navigation"
                  ? [event.navigation.screenPath]
                  : [],
            ),
          ),
        )
        .toEqual([
          "Product/Account/Details",
          "Product/Account/Details",
          "Product/Account/Details",
          "Product/Account/Guide",
        ]);
      expect(
        await frame.locator("body").evaluate(() => location.pathname),
      ).toBe(livePath);
    }
    expect(diagnostics).toEqual([]);
  } finally {
    await fixture.remove();
  }
});
