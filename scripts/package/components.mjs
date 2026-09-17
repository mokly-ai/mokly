import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

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
  const entries = crossPlatform ? "catalogue/entries" : "entries";
  const output = crossPlatform ? "docs/mockups" : "mockups";
  await fs.writeFile(path.join(root, entries, "components.mockup.tsx"), source);
  await runBin(root, ["build"]);
  await runBin(root, ["check"]);
  const manifest = JSON.parse(
    await fs.readFile(path.join(root, output, "mokly-manifest.json"), "utf8"),
  );
  assert.equal(manifest.schemaVersion, 5);
  assert.equal(
    manifest.entries.filter((entry) => entry.kind === "component").length,
    2,
  );
  const consumer = manifest.entries.find(
    (entry) => entry.id === "packed-components",
  );
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
    path.join(root, output, "mokly-manifest.json"),
    "utf8",
  );
  await smokeServer(root, ["--base", "HEAD"], async (url) => {
    const page = await (
      await fetch(`${url}/view/components/action.html`)
    ).text();
    const data = JSON.parse(
      page.match(/data-workspace-data="">(.*?)<\/script>/s)[1],
    );
    const capability = data.renderCapability;
    const response = await fetch(`${url}/__mokly/components/render`, {
      method: "POST",
      headers: {
        origin: url,
        "content-type": "application/json",
        "x-mokly-render-token": capability.token,
      },
      body: JSON.stringify({
        componentId: "packed-action",
        variantId: "default",
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
    await fs.readFile(path.join(root, output, "mokly-manifest.json"), "utf8"),
    before,
  );
  await runBin(root, ["export", "--out", "published", "--base", "HEAD"]);
  const review = await inspectConsumerExport(
    root,
    "published",
    "HEAD",
    ["view/components/action.html", "view/components/panel.html"],
    3,
  );
  assert.equal(review.components.length, 2);
  const published = await fs.readFile(
    path.join(root, "published/view/components/action.html"),
    "utf8",
  );
  assert.doesNotMatch(published, /renderCapability/);
}
