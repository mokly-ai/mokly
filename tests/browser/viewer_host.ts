import fs from "node:fs/promises";
import path from "node:path";

import { build } from "esbuild";

import { serveStaticFiles } from "../helpers/static_server.js";

/** An embedded viewer page served apart from the artifact it embeds. */
export interface HostedViewer {
  /** The host page again, behind a strict Content Security Policy. */
  cspUrl: string;
  /** The artifact origin that frames and snapshot documents load from. */
  frameOrigin: string;
  /** The host page origin serving `viewer.html`. */
  url: string;
  close(): Promise<void>;
}

/**
 * Bundle the test viewer entry into an exported artifact and serve it three
 * times: as the artifact origin, as a separate host page that mounts
 * `@mokly/viewer` over the exported catalogue object, and as that host behind
 * a strict Content Security Policy, so both frame adapters exercise the same
 * packaged output. `viewer.html?adapter=cross&entry=<id>` selects the
 * postMessage adapter and the opened entry.
 */
export async function hostExportedViewer(
  output: string,
): Promise<HostedViewer> {
  await build({
    bundle: true,
    entryPoints: [
      path.resolve("tests/browser/removed_preview_viewer_entry.tsx"),
    ],
    format: "esm",
    logLevel: "silent",
    outfile: path.join(output, "viewer.js"),
    platform: "browser",
    target: "es2023",
  });
  await fs.copyFile(
    "packages/viewer/dist/styles.css",
    path.join(output, "viewer.css"),
  );
  await fs.cp("packages/viewer/dist/assets", path.join(output, "assets"), {
    recursive: true,
  });
  const artifact = await serveStaticFiles(output);
  const catalogue: unknown = JSON.parse(
    await fs.readFile(path.join(output, "mokly-viewer/catalogue.json"), "utf8"),
  );
  const data = JSON.stringify({
    catalogue,
    frameOrigin: artifact.url,
  }).replaceAll("<", "\\u003c");
  await fs.writeFile(
    path.join(output, "fixture.js"),
    `window.fixture=${data};`,
  );
  await fs.writeFile(
    path.join(output, "viewer.html"),
    '<!doctype html><link rel="stylesheet" href="/viewer.css"><body><script src="/fixture.js"></script><script type="module" src="/viewer.js"></script></body>',
  );
  const host = await serveStaticFiles(output);
  const cspHost = await serveStaticFiles(output, {
    csp: [
      "default-src 'self'",
      "script-src 'self'",
      `connect-src 'self' ${artifact.url}`,
      `img-src 'self' ${artifact.url}`,
      `style-src 'self' 'unsafe-inline' ${artifact.url}`,
      `font-src 'self' ${artifact.url}`,
      `media-src 'self' ${artifact.url}`,
      `frame-src 'self' ${artifact.url}`,
      "object-src 'none'",
    ].join("; "),
  });
  artifact.allowOrigin(host.url);
  artifact.allowOrigin(cspHost.url);
  return {
    cspUrl: cspHost.url,
    frameOrigin: artifact.url,
    url: host.url,
    close: async () => {
      await host.close();
      await cspHost.close();
      await artifact.close();
    },
  };
}
