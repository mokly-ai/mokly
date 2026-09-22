import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { componentRuntime } from "../dist/build/component_runtime.js";
import { MANIFEST_NAME } from "../dist/registry/manifest.js";
import { ComponentRenderService } from "../dist/server/controls/service.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";

test("private controls rerender actual consumer code, keep immutable bundles and never change output", async (t) => {
  const fixture = await componentReviewFixture(t, (source) => source);
  const runtime = componentRuntime(fixture.after);
  assert.equal(new Map(runtime.outputs).has(MANIFEST_NAME), false);
  const service = new ComponentRenderService(runtime);
  fixture.beforeRemove(() => service.close());
  const baseline = await files(fixture.root);
  await fs.writeFile(fixture.entryPath, "invalid candidate source");
  const request = {
    componentId: "action",
    variantId: "default",
    generation: runtime.generation,
    viewport: "desktop",
    colorScheme: "light",
    pageId: "a".repeat(32),
    overrides: { label: { kind: "set", value: ["string", "Edited"] } },
  };
  const first = await service.render(request, new AbortController().signal);
  const original = service.store.get(first.renderId);
  assert.match(
    Buffer.from(original.files.get(original.route)!.bytes).toString(),
    /Edited/,
  );
  const second = await service.render(
    {
      ...request,
      overrides: { label: { kind: "set", value: ["string", "Again"] } },
    },
    new AbortController().signal,
  );
  assert.notEqual(first.renderId, second.renderId);
  assert.match(
    Buffer.from(original.files.get(original.route)!.bytes).toString(),
    /Edited/,
  );
  const after = await files(fixture.root);
  delete baseline["entries/fixture.mockup.tsx"];
  delete after["entries/fixture.mockup.tsx"];
  assert.deepEqual(after, baseline);
  await assert.rejects(compileCatalogue(fixture.config));
  await service.render(request, new AbortController().signal);
  service.replace({ ...runtime, generation: "replacement" });
  await assert.rejects(service.render(request, new AbortController().signal), {
    code: "stale-generation",
  });
  assert.throws(() => service.store.get(first.renderId), { code: "expired" });
});

test("render HTTP validates authority, body limits and methods; memory documents are script-disabled", async (t) => {
  const fixture = await componentReviewFixture(t, (source) => source);
  const runtime = componentRuntime(fixture.after);
  const server = await startCatalogueServer(fixture.config, {
    base: "main",
    port: 0,
    componentRuntime: runtime,
  });
  fixture.beforeRemove(() => server.close());
  const reactResponse = await fetch(
    `${server.url}/view/components/action.html`,
  );
  assert.equal(reactResponse.status, 200, await reactResponse.clone().text());
  const reactPage = await reactResponse.text();
  const state = reactPage.match(
    /data-mokly-host-capability-state="" type="application\/json">([^<]+)<\/script>/,
  )?.[1];
  assert.ok(state);
  const descriptor = JSON.parse(state) as {
    renderCapability: { generation: string; token: string };
    source: Record<string, unknown> & { renderGeneration: string };
    workspace: Record<string, unknown> & {
      views: { usage?: unknown }[];
    };
  };
  assert.equal(descriptor.renderCapability.generation, runtime.generation);
  assert.equal(descriptor.source.renderGeneration, runtime.generation);
  assert.equal("previewGeneration" in descriptor.source, false);
  assert.equal("previewGeneration" in descriptor.workspace, false);
  assert.ok(descriptor.workspace.views.length > 0);
  assert.ok(descriptor.workspace.views.every((view) => view.usage));
  const capability = descriptor.renderCapability;
  const body = {
    componentId: "action",
    variantId: "default",
    viewport: "mobile",
    colorScheme: "light",
    generation: capability.generation,
    pageId: "b".repeat(32),
    overrides: { label: { kind: "set", value: ["string", "From HTTP"] } },
  };
  const headers = {
    origin: server.url,
    "content-type": "application/json",
    "x-mokly-render-token": capability.token,
  };
  const endpoint = `${server.url}/__mokly/components/render`;
  for (const [altered, status] of [
    [{ ...headers, origin: "https://foreign.example" }, 403],
    [{ ...headers, "x-mokly-render-token": "bad" }, 403],
    [{ ...headers, "content-type": "text/plain" }, 400],
  ] as const)
    assert.equal(
      (
        await fetch(endpoint, {
          method: "POST",
          headers: altered,
          body: JSON.stringify(body),
        })
      ).status,
      status,
    );
  assert.equal(
    await new Promise<number>((resolve) => {
      const request = http.request(
        endpoint,
        { method: "POST", headers: { ...headers, host: "foreign.example" } },
        (response) => {
          response.resume();
          resolve(response.statusCode!);
        },
      );
      request.end(JSON.stringify(body));
    }),
    403,
  );
  assert.equal((await fetch(endpoint)).status, 405);
  assert.equal(
    (await fetch(endpoint, { method: "POST", headers, body: "broken" })).status,
    400,
  );
  assert.equal(
    (
      await fetch(endpoint, {
        method: "POST",
        headers,
        body: "x".repeat(65537),
      })
    ).status,
    413,
  );
  assert.equal(
    await new Promise<number>((resolve, reject) => {
      const request = http.request(
        endpoint,
        { method: "POST", headers },
        (response) => {
          response.resume();
          resolve(response.statusCode!);
        },
      );
      request.on("error", reject);
      request.write("x".repeat(32768));
      request.write("x".repeat(32768));
      request.end("x");
    }),
    413,
  );
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  assert.equal(response.status, 200, await response.clone().text());
  const result = await response.json();
  const preview = await fetch(server.url + result.previewUrl);
  assert.equal(preview.headers.get("cache-control"), "no-store");
  assert.equal(preview.headers.get("x-content-type-options"), "nosniff");
  assert.match(
    preview.headers.get("content-security-policy")!,
    /sandbox allow-same-origin/,
  );
  assert.match(await preview.text(), /From HTTP/);
  assert.ok(!JSON.stringify(fixture.after.manifest).includes(capability.token));
});

test("a running server can attach the retained component runtime after readiness", async (t) => {
  const fixture = await componentReviewFixture(t, (source) => source);
  const server = await startCatalogueServer(fixture.config, {
    base: "main",
    port: 0,
  });
  fixture.beforeRemove(() => server.close());

  const before = await (
    await fetch(`${server.url}/view/components/action.html`)
  ).text();
  assert.doesNotMatch(before, /"renderCapability"/);

  server.replaceComponentRuntime(componentRuntime(fixture.after));

  const after = await (
    await fetch(`${server.url}/view/components/action.html`)
  ).text();
  assert.match(after, /"renderCapability"/);
});

async function files(root: string): Promise<Record<string, string>> {
  const entries = await fs.readdir(root, {
    recursive: true,
    withFileTypes: true,
  });
  const result: Record<string, string> = {};
  for (const entry of entries)
    if (entry.isFile()) {
      const filename = path.join(entry.parentPath, entry.name);
      result[path.relative(root, filename)] = (
        await fs.readFile(filename)
      ).toString("base64");
    }
  return result;
}
