import fs from "node:fs/promises";
import path from "node:path";

import { build } from "esbuild";

import { crossOriginFixture } from "../../../tests/browser/frame_adapter_fixture.js";

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
