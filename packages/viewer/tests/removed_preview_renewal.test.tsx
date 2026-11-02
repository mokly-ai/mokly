import assert from "node:assert/strict";
import test from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, renderHook } from "@testing-library/react";

import { removedEntryDetailPath } from "../src/catalogue/delivery_paths.js";
import { snapshotViewPath } from "../src/navigation/routes.js";
import type { ComparisonEnvironment } from "../src/shell/comparison_context.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { ShellStoreProvider } from "../src/shell/store.js";
import { useRemovedPreview } from "../src/shell/use_removed_preview.js";

import { detailFixture, indexFixture } from "./catalogue_v9_fixture.js";
import { FakeDataSource, flush } from "./data_fakes.js";

test("a failed live preview renewal waits for a fenced route detail before new documents", async (t) => {
  const index = indexFixture();
  const record = index.removedEntries.find(
    (item) => item.entry.kind === "screen",
  );
  assert.ok(record?.snapshotId);
  const request = { path: record.entry.path, snapshotId: record.snapshotId };
  const detail = detailFixture(request);
  const origin = "https://catalogue.test";
  const routeUrl = `${origin}/view/${request.path}/?snapshot=${request.snapshotId}`;
  const generation = new URL(index.comparisonUrl!, origin);
  const renewal = new URL(
    removedEntryDetailPath(index.comparisonUrl!, request.path),
    origin,
  ).href;
  const desktop = new URL(
    snapshotViewPath("before", request.path, "desktop", "light"),
    generation,
  ).href;
  const mobile = new URL(
    snapshotViewPath("before", request.path, "mobile", "light"),
    generation,
  ).href;
  GlobalRegistrator.register({ url: routeUrl });
  const source = new FakeDataSource();
  const requests: string[] = [];
  const renewals: RequestInit[] = [];
  let expired = false;
  const environment: ComparisonEnvironment = {
    baseUrl: origin,
    delivery: () => ({ kind: "live" }),
    fetch: async (input, init) => {
      const url = String(input);
      requests.push(`${init?.method ?? "GET"} ${url}`);
      if (init?.method === "HEAD") {
        renewals.push(init);
        expired = true;
      }
      const response = new Response(
        "<html><head></head><body>Previous</body></html>",
        {
          status: expired ? 404 : 200,
          headers: { "content-type": "text/html" },
        },
      );
      Object.defineProperty(response, "url", { value: url });
      return response;
    },
  };
  const data = {
    ...request,
    kind: "screen" as const,
    title: record.entry.title,
    catalogueIdentity: index.identity.id,
    published: { kind: "screen" as const },
  };
  const hook = renderHook(
    ({ viewport }: { viewport: "desktop" | "mobile" }) =>
      useRemovedPreview({
        colorScheme: "light",
        data,
        interactive: true,
        viewport,
      }),
    {
      initialProps: { viewport: "desktop" },
      wrapper: ({ children }) => (
        <ShellStoreProvider
          comparisonEnvironment={environment}
          context={{ embedded: true }}
          index={index}
          initialDetails={[[request, detail]]}
          interactive
          route={(catalogue) => routeFromUrl(catalogue, new URL(routeUrl))}
          source={source}
        >
          {children}
        </ShellStoreProvider>
      ),
    },
  );
  t.after(async () => {
    hook.unmount();
    await GlobalRegistrator.unregister();
  });
  const status = () => hook.result.current.state.status;
  await act(flush);
  assert.equal(status(), "ready");
  assert.deepEqual([...requests], [`GET ${desktop}`]);
  await act(async () => {
    hook.rerender({ viewport: "mobile" });
    await flush();
  });
  assert.deepEqual([...requests], [`GET ${desktop}`, `HEAD ${renewal}`]);
  assert.deepEqual(
    renewals.map(({ credentials, cache, headers }) => ({
      credentials,
      cache,
      headers,
    })),
    [{ credentials: "omit", cache: "no-store", headers: undefined }],
  );
  assert.deepEqual(
    source.details.map((item) => item.input),
    [request],
  );
  assert.equal(status(), "loading");
  await act(async () => {
    source
      .detail(request.path, request.snapshotId)
      .resolve({ ...detail, detailId: "f".repeat(64) });
    await flush();
  });
  assert.equal(status(), "failed");
  assert.deepEqual(source.detailFailures, [request]);
  assert.deepEqual([...requests], [`GET ${desktop}`, `HEAD ${renewal}`]);
  act(() => hook.result.current.retry());
  assert.deepEqual(
    source.details.map((item) => item.input),
    [request, request],
  );
  await act(async () => {
    expired = false;
    source
      .detail(request.path, request.snapshotId)
      .resolve(structuredClone(detail));
    await flush();
  });
  assert.equal(status(), "ready");
  assert.deepEqual(
    [...requests],
    [`GET ${desktop}`, `HEAD ${renewal}`, `GET ${mobile}`],
  );
});
