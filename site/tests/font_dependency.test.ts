import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import test from "node:test";
import { pathToFileURL } from "node:url";

import type * as Undici from "undici";

const require = createRequire(import.meta.url);
const astroRequire = createRequire(require.resolve("astro/package.json"));
const fontRequire = createRequire(astroRequire.resolve("unifont"));

test("the installed font transport respects the approved workspace override", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../../package.json", import.meta.url), "utf8"),
  ) as { overrides: { unifont: { undici: string } } };
  const installed = JSON.parse(
    await readFile(fontRequire.resolve("undici/package.json"), "utf8"),
  ) as { version: string };
  assert.equal(
    installed.version,
    manifest.overrides.unifont.undici,
    "npm must preserve the Node 22.14-compatible Unifont override when updating the lockfile",
  );
});

test("Unifont's scoped Undici supports its dispatcher API and real HTTP", async (t) => {
  const undici = (await import(
    pathToFileURL(fontRequire.resolve("undici")).href
  )) as typeof Undici;
  const server = createServer((_request, response) =>
    response.end("font transport"),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const previous = undici.getGlobalDispatcher();
  const dispatcher = new undici.EnvHttpProxyAgent({ noProxy: "*" });
  const agent = new undici.Agent();
  try {
    undici.setGlobalDispatcher(agent);
    assert.ok(undici.getGlobalDispatcher() instanceof undici.Agent);
    undici.setGlobalDispatcher(dispatcher);
    assert.equal(undici.getGlobalDispatcher(), dispatcher);
    const response = await fetch(`http://127.0.0.1:${address.port}`);
    assert.equal(await response.text(), "font transport");
  } finally {
    undici.setGlobalDispatcher(previous);
    await dispatcher.close();
    await agent.close();
  }
});
