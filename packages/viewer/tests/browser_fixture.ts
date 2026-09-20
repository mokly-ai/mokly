import fs from "node:fs/promises";
import path from "node:path";

import { build } from "esbuild";

import { crossOriginFixture } from "../../../tests/browser/frame_adapter_fixture.js";
import { renderViewer } from "../dist/server.js";

export async function viewerFixture(
  extraConfig = "",
  options?: Parameters<typeof crossOriginFixture>[0],
) {
  const fixture = await crossOriginFixture(options, extraConfig);
  await build({
    entryPoints: [path.resolve("packages/viewer/tests/browser_entry.tsx")],
    outfile: path.join(fixture.root, "viewer.js"),
    bundle: true,
    platform: "browser",
    format: "esm",
    target: "es2023",
    logLevel: "silent",
  });
  await fs.writeFile(
    path.join(fixture.root, "index.html"),
    `<!doctype html><link rel="stylesheet" href="/viewer.css"><body><script>window.fixture=${JSON.stringify({ catalogue: fixture.catalogue, baseUrl: fixture.frames.url }).replaceAll("<", "\\u003c")}</script><script type="module" src="/viewer.js"></script></body>`,
  );
  await fs.copyFile(
    "packages/viewer/dist/styles.css",
    path.join(fixture.root, "viewer.css"),
  );
  await fs.cp(
    "packages/viewer/dist/assets",
    path.join(fixture.root, "assets"),
    { recursive: true },
  );
  return fixture;
}

/** Serve a public viewer's server HTML and hydrate it with the host React copy. */
export async function viewerHydrationFixture() {
  const fixture = await crossOriginFixture();
  await build({
    entryPoints: [
      path.resolve("packages/viewer/tests/browser_hydration_entry.tsx"),
    ],
    outfile: path.join(fixture.root, "viewer-hydration.js"),
    bundle: true,
    platform: "browser",
    format: "esm",
    target: "es2023",
    logLevel: "silent",
  });
  const defaultSelection = {
    screenId: "home",
    view: "all" as const,
    viewport: "mobile" as const,
    colorScheme: "light" as const,
    search: "",
    tags: [],
  };
  const html = renderViewer({
    catalogue: fixture.catalogue,
    baseUrl: fixture.host.url,
    defaultSelection,
  });
  const data = JSON.stringify({
    catalogue: fixture.catalogue,
    baseUrl: fixture.host.url,
    defaultSelection,
  }).replaceAll("<", "\\u003c");
  await fs.writeFile(
    path.join(fixture.root, "hydration.html"),
    `<!doctype html><meta charset="utf-8"><link href="data:," rel="icon"><link rel="stylesheet" href="/viewer.css"><body><section id="hydration-root">${html}</section><script>window.fixture=${data};window.viewerHydrationProbe={shell:document.querySelector("#hydration-root [data-mokly-shell]"),frame:document.querySelector("#hydration-root .mbk-frag")}</script><script type="module" src="/viewer-hydration.js"></script></body>`,
  );
  await fs.copyFile(
    "packages/viewer/dist/styles.css",
    path.join(fixture.root, "viewer.css"),
  );
  await fs.cp(
    "packages/viewer/dist/assets",
    path.join(fixture.root, "assets"),
    { recursive: true },
  );
  return fixture;
}
