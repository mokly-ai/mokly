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
    screenId: "action",
    view: "all" as const,
    viewport: "mobile" as const,
    colorScheme: "light" as const,
    search: "",
    tags: [],
  };
  const viewers = [
    { rootId: "hydration-primary", viewerId: "primary" },
    { rootId: "hydration-secondary", viewerId: "secondary" },
  ];
  const html = viewers
    .map(
      ({ rootId, viewerId }) =>
        `<section id="${rootId}">${renderViewer({
          viewerId,
          catalogue: fixture.catalogue,
          baseUrl: fixture.host.url,
          defaultSelection,
        })}</section>`,
    )
    .join("");
  const data = JSON.stringify({
    catalogue: fixture.catalogue,
    baseUrl: fixture.host.url,
    defaultSelection,
    viewers,
  }).replaceAll("<", "\\u003c");
  await fs.writeFile(
    path.join(fixture.root, "hydration.html"),
    `<!doctype html><meta charset="utf-8"><link href="data:," rel="icon"><link rel="stylesheet" href="/viewer.css"><body>${html}<script>window.fixture=${data};window.viewerHydrationProbe=Object.fromEntries(window.fixture.viewers.map(({rootId})=>{const root=document.getElementById(rootId);return [rootId,{shell:root.querySelector("[data-mokly-shell]"),frame:root.querySelector(".mbk-frag")}]}))</script><script type="module" src="/viewer-hydration.js"></script></body>`,
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
