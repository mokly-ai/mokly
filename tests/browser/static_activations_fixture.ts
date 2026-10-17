import fs from "node:fs/promises";
import path from "node:path";

import { ownBrowserCleanup } from "../../packages/viewer/tests/browser_cleanup.js";
import { buildStaticCatalogue } from "../helpers/build_site.js";
import { repositoryRoot } from "../helpers/fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

export async function staticActivationFixture() {
  const root = await fs.mkdtemp(
    path.join(
      process.env["MOKLY_VERIFICATION_RESOURCE_ROOT"] ??
        path.join(repositoryRoot, ".context"),
      "static-activation-",
    ),
  );
  const hosts: Awaited<ReturnType<typeof serveStaticFiles>>[] = [];
  ownBrowserCleanup(async () => {
    for (const host of hosts) await host.close();
    await fs.rm(root, { recursive: true, force: true });
  });
  const source = path.join(root, "source");
  await fs.mkdir(path.join(source, "specs"), { recursive: true });
  await fs.writeFile(
    path.join(source, "mokly.config.json"),
    JSON.stringify({
      repoRoot: ".",
      roots: [{ dir: "specs" }],
      colorSchemes: ["light", "dark"],
    }),
  );
  await fs.writeFile(
    path.join(source, "specs/home.screen.html"),
    `---
title: Home
colorSchemes: [light]
---
<main><input aria-label="Native input"><a href="mock:details#details">Details</a><a href="mock:details#details" target="_blank">New tab</a><a href="mock:details#details" target="review-window">Named tab</a></main>`,
  );
  await fs.writeFile(
    path.join(source, "specs/details.screen.html"),
    '---\ntitle: Details\n---\n<main id="details">Details destination</main>',
  );
  const output = path.join(source, "site");
  await buildStaticCatalogue(source, output);
  const copied = path.join(root, "site");
  await fs.cp(output, copied, { recursive: true });
  await fs.rm(source, { recursive: true });
  const host = await serveStaticFiles(copied);
  hosts.push(host);
  return host;
}
