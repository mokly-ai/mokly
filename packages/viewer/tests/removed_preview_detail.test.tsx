import assert from "node:assert/strict";
import test from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, fireEvent, render } from "@testing-library/react";

import type { ComparisonEnvironment } from "../src/shell/comparison_context.js";
import { RemovedPreviewStage } from "../src/shell/previews.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { ShellStoreProvider } from "../src/shell/store.js";

import { detailFixture, indexFixture } from "./catalogue_v9_fixture.js";
import { FakeDataSource, flush } from "./data_fakes.js";

test("a rejected removed detail shows no preview and Retry requests the route detail again", async (t) => {
  const index = indexFixture();
  const record = index.removedEntries.find(
    (item) => item.entry.kind === "screen",
  );
  assert.ok(record?.snapshotId);
  const request = { path: record.entry.path, snapshotId: record.snapshotId };
  const detail = detailFixture(request);
  const rejected = { ...detail, detailId: "f".repeat(64) };
  const origin = "https://catalogue.test";
  const url = `${origin}/view/${request.path}/?snapshot=${request.snapshotId}`;
  GlobalRegistrator.register({ url });
  const source = new FakeDataSource();
  const requests: string[] = [];
  const environment: ComparisonEnvironment = {
    baseUrl: origin,
    delivery: () => ({ kind: "pinned", comparisonUrl: index.comparisonUrl }),
    fetch: async (input) => {
      const address = String(input);
      requests.push(address);
      const response = address.endsWith(".json")
        ? Response.json(rejected)
        : new Response(
            "<!doctype html><html><head></head><body>Previous</body></html>",
            {
              headers: { "content-type": "text/html" },
            },
          );
      Object.defineProperty(response, "url", { value: address });
      return response;
    },
  };
  const view = render(
    <ShellStoreProvider
      comparisonEnvironment={environment}
      context={{ embedded: true }}
      index={index}
      interactive
      route={(catalogue) => routeFromUrl(catalogue, new URL(url))}
      source={source}
    >
      <RemovedPreviewStage
        data={{
          path: request.path,
          kind: "screen",
          title: record.entry.title,
          catalogueIdentity: index.identity.id,
          snapshotId: request.snapshotId,
          published: { kind: "screen" },
        }}
      />
    </ShellStoreProvider>,
  );
  t.after(async () => {
    view.unmount();
    await GlobalRegistrator.unregister();
  });
  assert.match(view.container.textContent, /Loading previous version/);
  await act(async () => {
    source.detail(request.path, request.snapshotId).resolve(rejected);
    await flush();
  });
  assert.equal(
    view.container.querySelector("h2")?.textContent,
    "Previous version unavailable",
  );
  assert.equal(view.container.querySelector("iframe"), null);
  assert.deepEqual(source.detailFailures, [request]);
  assert.deepEqual(requests, []);
  fireEvent.click(view.getByRole("button", { name: "Retry" }));
  assert.deepEqual(
    source.details.map((item) => item.input),
    [request, request],
  );
  assert.match(view.container.textContent, /Loading previous version/);
  await act(async () => {
    source.detail(request.path, request.snapshotId).resolve(detail);
    await flush();
  });
  assert.ok(view.container.querySelector("iframe[data-mokly-preview-frame]"));
  assert.equal(requests.length, detail.views.length);
  for (const address of requests)
    assert.ok(
      address.startsWith(`${origin}/${index.comparisonUrl}snapshots/before/`),
      address,
    );
});
