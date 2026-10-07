import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { inspectConsumerExport } from "./export.mjs";
import { runBin, smokeServer } from "./fixture.mjs";

/** Exercise the installed component API, worker, provider graph and static exporter. */
export async function smokeRegisteredComponents(
  context,
  root,
  crossPlatform = false,
) {
  let source = await fs.readFile(
    path.join(context.fixturesRoot, "components/component.mockup.tsx"),
    "utf8",
  );
  if (crossPlatform)
    source = `import { FirnaCard } from "@firna/ui";\n${source}`.replace(
      "<section data-component-preview>{children}</section>",
      '<FirnaCard accent="#345678">{children}</FirnaCard>',
    );
  else {
    source = source.replace(
      'path: "packed-action",',
      'path: "packed-action", stylesheets: ["component.css"],',
    );
    await fs.writeFile(
      path.join(root, "mockups/component.css"),
      "button{color:navy}",
    );
  }
  const entries = crossPlatform ? "catalogue/entries" : "entries";
  const output = crossPlatform ? "docs/mockups" : "mockups";
  await fs.writeFile(path.join(root, entries, "components.mockup.tsx"), source);
  await runBin(root, ["build"]);
  await runBin(root, ["check"]);
  const manifest = JSON.parse(
    await fs.readFile(
      path.join(root, output, "mokly-generated/mokly-manifest.json"),
      "utf8",
    ),
  );
  assert.equal(manifest.schemaVersion, 9);
  const componentEntries = manifest.entries.filter(
    (entry) => entry.kind === "component",
  );
  assert.equal(
    componentEntries.filter((entry) => !("variantOf" in entry)).length,
    2,
  );
  assert.equal(
    componentEntries.filter((entry) => "variantOf" in entry).length,
    3,
  );
  const consumer = manifest.entries.find(
    (entry) => entry.path === "packed-components",
  );
  if (!crossPlatform) {
    const action = manifest.entries.find(
      (entry) => entry.path === "packed-action",
    );
    const variant = componentEntries.find(
      (entry) => entry.variantOf === action.path,
    );
    const view = variant.componentViews[0];
    assert.deepEqual(view.resources, []);
    assert.deepEqual(
      view.insertedStylesheets.map(({ path, componentPaths }) => ({
        path,
        componentPaths,
      })),
      [{ path: "component.css", componentPaths: ["packed-action"] }],
    );
    assert.equal(
      view.ranges.filter((range) => range.target.kind === "root").length,
      1,
    );
    const { generatedResourcePath, viewRoute } = await import(
      pathToFileURL(path.join(root, "node_modules/@mokly/viewer/dist/data.js"))
        .href
    );
    const html = await fs.readFile(
      path.join(
        root,
        output,
        generatedResourcePath(viewRoute(variant.path, "mobile", "light")),
      ),
      "utf8",
    );
    assert.match(
      html,
      /<link rel="stylesheet" href="\.\.\/\.\.\/\.\.\/component\.css">/,
    );
  }
  for (const view of consumer.componentViews) {
    assert.ok(view.instances.length > 0);
    for (const instance of view.instances) {
      assert.equal(instance.source.path, `${entries}/components.mockup.tsx`);
      const invocationLine = source.split("\n")[instance.source.line - 1];
      assert.ok(
        invocationLine.slice(instance.source.column - 1).startsWith("<"),
      );
    }
  }
  const before = await fs.readFile(
    path.join(root, output, "mokly-generated/mokly-manifest.json"),
    "utf8",
  );
  await smokeServer(root, ["--base", "HEAD"], async (url) => {
    const page = await (await fetch(`${url}/view/packed-action/`)).text();
    const state = page.match(
      /<script[^>]*data-mokly-host-capability-state=""[^>]*>([^<]+)<\/script>/,
    );
    assert.ok(state);
    const capability = JSON.parse(state[1]).renderCapability;
    assert.ok(capability);
    const response = await fetch(`${url}/mokly-viewer/components/render`, {
      method: "POST",
      headers: {
        origin: url,
        "content-type": "application/json",
        "x-mokly-render-token": capability.token,
      },
      body: JSON.stringify({
        componentId: "packed-action",
        variantPath: "packed-action/default",
        viewport: "mobile",
        colorScheme: "light",
        generation: capability.generation,
        pageId: "1".repeat(32),
        overrides: { label: { kind: "set", value: ["string", "Packed edit"] } },
      }),
    });
    assert.equal(response.status, 200, await response.clone().text());
    const rendered = await response.json();
    const html = await (await fetch(url + rendered.previewUrl)).text();
    assert.match(html, /Packed edit/);
    if (crossPlatform) assert.match(html, /data-theme="fixture-theme"/);
  });
  assert.equal(
    await fs.readFile(
      path.join(root, output, "mokly-generated/mokly-manifest.json"),
      "utf8",
    ),
    before,
  );
  await runBin(root, ["export", "--out", "published", "--base", "HEAD"]);
  const review = await inspectConsumerExport(
    root,
    "published",
    "HEAD",
    ["view/packed-action/index.html", "view/packed-panel/index.html"],
    6,
  );
  assert.equal(review.components.length, 2);
  const published = await fs.readFile(
    path.join(root, "published/view/packed-action/index.html"),
    "utf8",
  );
  assert.doesNotMatch(published, /renderCapability/);
}
