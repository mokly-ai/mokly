import fs from "node:fs/promises";
import path from "node:path";

import { build } from "esbuild";

import { ownBrowserCleanup } from "../../packages/viewer/tests/browser_cleanup.js";
import { repositoryRoot } from "../helpers/fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

import { copiedStaticDirectory } from "./static_test.js";

/** Native rendered documents pass through the real Review loader and pane guard. */
export async function reviewSnapshotFixture() {
  const root = await fs.mkdtemp(
    path.join(
      process.env["MOKLY_VERIFICATION_RESOURCE_ROOT"] ??
        path.join(repositoryRoot, ".context"),
      "review-link-",
    ),
  );
  const hosts: Awaited<ReturnType<typeof serveStaticFiles>>[] = [];
  ownBrowserCleanup(async () => {
    for (const host of hosts) await host.close();
    await fs.rm(root, { recursive: true, force: true });
  });
  const generation = "mokly-viewer/diffs/generations/" + "a".repeat(64);
  await fs.cp(
    path.join(copiedStaticDirectory(), "static"),
    path.join(root, generation, "snapshots/before"),
    { recursive: true },
  );
  await fs.cp(
    path.join(copiedStaticDirectory(), "mokly-viewer/client"),
    path.join(root, "mokly-viewer/client"),
    { recursive: true },
  );
  await fs.writeFile(
    path.join(root, "index.html"),
    '<!doctype html><link rel="icon" href="data:,"><main id="pane"></main><script type="module" src="/pane.js"></script>',
  );
  await build({
    stdin: {
      contents: `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {ComparisonFrame} from './packages/viewer/src/shell/comparison_frame.tsx';
import {createSnapshotPresentationLoader} from './packages/viewer/src/previews/presentation.ts';
const generation=new URL(${JSON.stringify("/" + generation + "/")},location.origin).href;
const suffix=new URL(location.href).searchParams.get('view') || 'mobile';
const address=generation+'snapshots/before/mokly-generated/example/screens/welcome/index.'+suffix+'.html';
const loader=createSnapshotPresentationLoader(generation,['before'],{kind:'pinned',comparisonUrl:generation+'review.json'}, {
 baseUrl:location.origin,fetch:(input,init)=>fetch(input,init),parse:source=>new DOMParser().parseFromString(source,'text/html')
});
const presentation=await loader.load(address,new AbortController().signal);
createRoot(document.getElementById('pane')).render(React.createElement(ComparisonFrame,{presentation,side:'before',title:'Before'}));
`,
      resolveDir: repositoryRoot,
      sourcefile: "snapshot-pane.tsx",
    },
    outfile: path.join(root, "pane.js"),
    bundle: true,
    platform: "browser",
    format: "esm",
    target: "es2023",
    logLevel: "silent",
  });
  const host = await serveStaticFiles(root);
  hosts.push(host);
  return host;
}
