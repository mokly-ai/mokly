import fs from "node:fs/promises";
import path from "node:path";

import { build } from "esbuild";

import { ownBrowserCleanup } from "../../packages/viewer/tests/browser_cleanup.js";
import { repositoryRoot } from "../helpers/fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

import { copiedStaticDirectory } from "./static_test.js";

/** A real public viewer fetches unmodified copied output from a separate origin. */
export async function staticEmbeddedFixture() {
  const root = await fs.mkdtemp(
    path.join(
      process.env["MOKLY_VERIFICATION_RESOURCE_ROOT"] ??
        path.join(repositoryRoot, ".context"),
      "static-embed-",
    ),
  );
  const hosts: Awaited<ReturnType<typeof serveStaticFiles>>[] = [];
  ownBrowserCleanup(async () => {
    for (const host of hosts.reverse()) await host.close();
    await fs.rm(root, { recursive: true, force: true });
  });
  const host = await serveStaticFiles(root);
  hosts.push(host);
  const frames = await serveStaticFiles(copiedStaticDirectory(), {
    allowedOrigin: host.url,
  });
  hosts.push(frames);
  await build({
    stdin: {
      contents: `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {MoklyViewer, postMessageAdapter} from '@mokly/viewer';
const origin=${JSON.stringify(frames.url)};
createRoot(document.getElementById('viewer')).render(React.createElement(MoklyViewer, {
 index:new URL('/mokly-viewer/index.json',origin),
 detail:path=>new URL('/mokly-viewer/entries/'+path+'.json',origin),
 frameAdapter:postMessageAdapter({frameOrigin:origin}),
 defaultSelection:{screenPath:'example/screens/welcome',view:'all',viewport:'mobile',colorScheme:'light',search:'',tags:[]},
 onError:error=>console.error('Static embedded viewer: '+error.message)
}));`,
      resolveDir: repositoryRoot,
      sourcefile: "static-embed.tsx",
    },
    outfile: path.join(root, "viewer.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2023",
    logLevel: "silent",
  });
  await fs.writeFile(
    path.join(root, "index.html"),
    '<!doctype html><link rel="icon" href="data:,"><link rel="stylesheet" href="/viewer.css"><body><main id="viewer" style="height:900px;width:1200px"></main><script type="module" src="/viewer.js"></script></body>',
  );
  await fs.copyFile(
    path.join(repositoryRoot, "packages/viewer/dist/styles.css"),
    path.join(root, "viewer.css"),
  );
  await fs.cp(
    path.join(repositoryRoot, "packages/viewer/dist/assets"),
    path.join(root, "assets"),
    { recursive: true },
  );
  return { host, frames };
}
