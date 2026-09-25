import fs from "node:fs";
import path from "node:path";

import {
  loadBrowserClientModules,
  loadBrowserNavigationModules,
  loadShellFontAssets,
} from "../../dist/server/client_modules.js";

const liveHostScript =
  '<script src="/__mokly/client/react-host.js" type="module"></script>';
const staticHydrationScript =
  '<script src="/__mokly/client/react-shell.js" type="module"></script>';

/** Capture the shell assets needed by the static preview. */
export async function captureAssets(serverUrl, stage) {
  for (const asset of shellAssets()) {
    const response = await fetch(`${serverUrl}${asset}`);
    if (!response.ok)
      throw new Error(`preview asset ${asset} returned ${response.status}`);
    await writeFile(
      stage,
      asset.slice(1),
      Buffer.from(await response.arrayBuffer()),
    );
  }
}

function shellAssets() {
  return [
    "/__mokly/shell.css",
    ...[...loadBrowserClientModules().keys()]
      .filter(
        (name) =>
          name !== "host_capabilities.js" &&
          name !== "host_capability_descriptor.js" &&
          name !== "react_capabilities.js" &&
          name !== "react_capability_updates.js" &&
          name !== "react_transports.js" &&
          name !== "react_update_controller.js" &&
          name !== "react-host.js",
      )
      .map((name) => `/__mokly/client/${name}`),
    ...[...loadBrowserNavigationModules().keys()].map(
      (name) => `/__mokly/navigation/${name}`,
    ),
    ...[...loadShellFontAssets().keys()].map(
      (name) => `/__mokly/fonts/${name}`,
    ),
  ];
}

/** Capture an HTTP page and replace its live shell with a static one. */
export async function capturePage(
  serverUrl,
  route,
  stage,
  relativePath,
  expectedStatus = 200,
) {
  const response = await fetch(`${serverUrl}${route}`);
  if (response.status !== expectedStatus) {
    throw new Error(
      `preview page ${route} returned ${response.status}, expected ${expectedStatus}`,
    );
  }
  const html = await response.text();
  if (!html.includes(liveHostScript)) {
    throw new Error(`preview page ${route} is missing its live host script`);
  }
  await writeText(stage, relativePath, staticPage(html));
}

function staticPage(html) {
  return html
    .replace(' data-mokly-host-capabilities=""', "")
    .replace(
      /<script data-mokly-host-capability-state="" type="application\/json">[^<]*<\/script>/,
      "",
    )
    .replace(liveHostScript, staticHydrationScript)
    .replace(
      /(href|src|data-fragment-light|data-fragment-dark)="\/(static|view)\/([^"]+)\.html"/g,
      '$1="/$2/$3"',
    );
}

/** Stage UTF-8 shell or catalogue text at a relative preview path. */
export async function writeText(root, relative, content) {
  await writeFile(root, relative, Buffer.from(content));
}

async function writeFile(root, relative, content) {
  const target = path.join(root, relative);
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.writeFile(target, content);
}
