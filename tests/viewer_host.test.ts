import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { hostExportedViewer } from "./browser/viewer_host.js";
import { repositoryRoot } from "./helpers/fixture.js";

test("the embedded host declares an empty same-origin icon that its strict CSP allows", async (context) => {
  const output = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/m8-viewer-host-"),
  );
  const resources: { host?: Awaited<ReturnType<typeof hostExportedViewer>> } =
    {};
  context.after(async () => {
    await resources.host?.close();
    await fs.rm(output, { recursive: true, force: true });
  });
  await fs.mkdir(path.join(output, "__mokly"));
  await fs.writeFile(path.join(output, "__mokly/catalogue.json"), "{}");
  const host = await hostExportedViewer(output);
  resources.host = host;
  for (const origin of [host.url, host.cspUrl]) {
    const response = await fetch(`${origin}/viewer.html`);
    const html = await response.text();
    const href = /<link rel="icon" href="([^"]+)">/u.exec(html)?.[1];
    assert.ok(href, html);
    const iconUrl = new URL(href, `${origin}/viewer.html`);
    assert.equal(iconUrl.origin, origin);
    const icon = await fetch(iconUrl);
    assert.equal(icon.status, 200);
    assert.equal((await icon.arrayBuffer()).byteLength, 0);
    if (origin === host.cspUrl)
      assert.match(
        response.headers.get("content-security-policy") ?? "",
        /img-src 'self'/u,
      );
  }
});
