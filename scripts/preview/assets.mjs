import fs from "node:fs";
import path from "node:path";

import {
  loadBrowserClientModules,
  loadBrowserNavigationModules,
  loadShellFontAssets,
} from "../../dist/server/client_modules.js";

/** Copy the static shell's exact browser asset inventory into a preview. */
export async function captureAssets(serverUrl, stage) {
  for (const asset of shellAssets()) {
    const response = await fetch(`${serverUrl}${asset}`);
    if (!response.ok)
      throw new Error(`preview asset ${asset} returned ${response.status}`);
    const target = path.join(stage, asset.slice(1));
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(
      target,
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
