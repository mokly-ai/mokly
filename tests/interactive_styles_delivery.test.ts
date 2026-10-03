import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";

import { NodeInteractiveServerFactory } from "../dist/interactive/server.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { ControlledInteractiveBundler } from "./helpers/interactive_server.js";
import {
  acceptedStyles,
  interactiveStylesFixture,
} from "./helpers/interactive_styles.js";

for (const mode of ["derived", "committed"] as const) {
  test(`Live serves accepted stylesheet and asset bytes in ${mode} output`, async (t) => {
    const fixture = await interactiveStylesFixture(mode);
    t.after(() => fixture.remove());
    const runtime = await acceptedStyles(fixture.root);
    const bundler = new ControlledInteractiveBundler();
    const server = await startCatalogueServer(runtime.config, {
      base: "main",
      changesStatus: "unavailable",
      componentRuntime: runtime,
      interactiveServerFactory: new NodeInteractiveServerFactory(bundler),
      manifest: runtime.manifest,
      port: 0,
    });
    t.after(() => server.close());
    const origin = server.interactiveOrigin!;
    assert.ok(origin);
    for (const [route, content] of runtime.styleOutputs) {
      const file = path.join(fixture.mockupsDir, route);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, "stale disk bytes");
      const response = await fetch(`${origin}/static/${route}`);
      assert.equal(response.status, 200, route);
      assert.deepEqual(
        Buffer.from(await response.arrayBuffer()),
        Buffer.from(content),
      );
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.match(
        response.headers.get("content-type")!,
        route.endsWith(".css") ? /text\/css/ : /image\/png/,
      );
      const head = await fetch(`${origin}/static/${route}`, { method: "HEAD" });
      assert.equal(head.status, 200);
      assert.equal((await head.arrayBuffer()).byteLength, 0);
      assert.equal(
        (await fetch(`${origin}/static/${route}?v=accepted`)).status,
        200,
      );
      await fs.rm(file);
      assert.equal((await fetch(`${origin}/static/${route}`)).status, 200);
    }
    assert.equal(bundler.requests.length, 0);
    const viewUrl = `${origin}/static/screens/home.desktop.html`;
    assert.equal((await fetch(viewUrl)).status, 503);
    bundler.succeed(runtime.generation);
    await setImmediate();
    const response = await fetch(viewUrl);
    assert.equal(response.status, 200);
    const html = await response.text();
    const links = [...html.matchAll(/<link[^>]+href="([^"]+)"/g)].map(
      (match) => new URL(match[1]!, viewUrl),
    );
    const styles = links.filter((url) =>
      url.pathname.includes("mokly-generated/styles/"),
    );
    assert.ok(styles.length);
    for (const url of styles)
      assert.equal((await fetch(url)).status, 200, url.href);
    const css = await (await fetch(styles[0]!)).text();
    const asset = css.match(/url\(["']?([^)'"\s]+)/)?.[1];
    assert.ok(asset);
    assert.equal((await fetch(new URL(asset, styles[0]))).status, 200);
    for (const route of [
      "mokly-manifest.json",
      "mokly-generated/styles/stale.css",
      "entries/card.module.css",
      "pages/guide.html",
    ])
      assert.equal(
        (await fetch(`${origin}/static/${route}`)).status,
        404,
        route,
      );
    assert.equal(
      (
        await fetch(
          `${origin}/static/mokly-generated/styles/%2e%2e%2fmissing.css`,
        )
      ).status,
      400,
    );
  });
}
