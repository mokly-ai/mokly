import assert from "node:assert/strict";

import {
  currentDocumentPath,
  type EntryDetailV4,
} from "../../packages/model/dist/index.js";
import { readEntryDetail } from "../../packages/viewer/src/catalogue/detail_reader.js";
import { readCatalogueIndex } from "../../packages/viewer/src/catalogue/index_reader.js";
import {
  snapshotViewPath,
  viewRoute,
} from "../../packages/viewer/src/navigation/routes.js";

import { completed } from "./mokly_serve.js";
import { timings } from "./static_timings.js";

export function comparisonCounts(stderr: string) {
  const counts = timings(stderr)
    .filter(
      (record) =>
        record.stage === "review.compare-views" && record.event === "counts",
    )
    .at(-1);
  assert.ok(counts, stderr);
  return {
    views: counts.views,
    unchanged: counts.unchanged,
    changed: counts.changed,
    ignoredOnly: counts.ignoredOnly,
  };
}

export function diagnostics(stderr: string) {
  return stderr
    .split("\n")
    .filter((line) => line !== "" && !line.startsWith("[mokly:timing] "));
}

/** Capture every detail, comparison body, stylesheet, and asset of this fixture. */
export async function publication(url: string, signal: AbortSignal) {
  let index = readCatalogueIndex(
    await (await fetch(`${url}/mokly-viewer/index.json`, { signal })).json(),
  );
  for (const entry of [...index.screens, ...index.components])
    await completed(url, signal, entry.path, fetch, { settledUsage: true });
  index = readCatalogueIndex(
    await (await fetch(`${url}/mokly-viewer/index.json`, { signal })).json(),
  );
  assert.equal(index.changesStatus, "ready");
  assert.ok(index.comparisonUrl);
  const details: Record<string, EntryDetailV4> = {};
  const bodies: Record<string, [string, string]> = {};
  const selectedRoots: Record<string, string> = {};
  const readDetail = async (route: string) => {
    const response = await fetch(new URL(route, `${url}/`), { signal });
    assert.equal(response.status, 200, route);
    return readEntryDetail(await response.json());
  };
  const collect = async (address: URL, scope: URL, prefix: string) => {
    const key = prefix + address.pathname.slice(scope.pathname.length);
    if (bodies[key]) return;
    const response = await fetch(address, { signal });
    assert.equal(response.status, 200, address.href);
    const bytes = Buffer.from(await response.arrayBuffer());
    const type = response.headers.get("content-type") ?? "";
    bodies[key] = [type, bytes.toString("base64")];
    const text = bytes.toString("utf8");
    const references = type.includes("html")
      ? [
          ...text.matchAll(
            /<(?:link|img|script|iframe)\b[^>]*\b(?:src|href)="([^"]+)"/gu,
          ),
        ].map((match) => match[1]!)
      : type.includes("css")
        ? [
            ...text.matchAll(/(?:url\(\s*["']?|@import\s+["'])([^"')\s;]+)/gu),
          ].map((match) => match[1]!)
        : [];
    for (const reference of references) {
      const target = new URL(reference, address);
      if (
        target.origin === address.origin &&
        target.pathname.startsWith(scope.pathname)
      )
        await collect(target, scope, prefix);
    }
  };
  for (const entry of [
    ...index.screens,
    ...index.components,
    ...index.pages,
    ...index.documents,
    ...index.useCases,
  ]) {
    const detail = await readDetail(`mokly-viewer/entries/${entry.path}.json`);
    assert.equal(detail.detailId, entry.detailId);
    assert.equal(detail.revision, index.revision);
    details[`current/${entry.path}`] = { ...detail, revision: 0 };
    for (const view of detail.views) {
      const current = new URL("static/", `${url}/`);
      await collect(
        new URL(
          currentDocumentPath(
            viewRoute(entry.path, view.viewport, view.colorScheme),
          ),
          `${url}/`,
        ),
        current,
        "current/",
      );
    }
    if (entry.kind !== "screen" && entry.kind !== "component") continue;
    const selected = await fetch(
      `${url}/mokly-viewer/diffs/selection?path=${encodeURIComponent(entry.path)}`,
      { signal },
    );
    assert.equal(selected.status, 204, entry.path);
    const scope = new URL(selected.url);
    selectedRoots[entry.path] = scope.pathname;
    for (const view of detail.views) {
      if (detail.before)
        await collect(
          new URL(
            snapshotViewPath(
              "before",
              detail.before.path,
              view.viewport,
              view.colorScheme,
            ),
            scope,
          ),
          scope,
          `selected/${entry.path}/`,
        );
      await collect(
        new URL(
          snapshotViewPath(
            "after",
            entry.path,
            view.viewport,
            view.colorScheme,
          ),
          scope,
        ),
        scope,
        `selected/${entry.path}/`,
      );
    }
  }
  for (const removed of index.removedEntries) {
    const detail = await readDetail(
      `${index.comparisonUrl}entries/${removed.entry.path}.json`,
    );
    assert.equal(detail.detailId, removed.entry.detailId);
    details[`removed/${removed.entry.path}`] = detail;
    const scope = new URL(index.comparisonUrl, `${url}/`);
    for (const view of detail.views)
      await collect(
        new URL(
          snapshotViewPath(
            "before",
            removed.entry.path,
            view.viewport,
            view.colorScheme,
          ),
          scope,
        ),
        scope,
        "removed/",
      );
  }
  const fence = readCatalogueIndex(
    await (await fetch(`${url}/mokly-viewer/index.json`, { signal })).json(),
  );
  assert.deepEqual(
    fence,
    index,
    "all metadata and bodies belong to the same complete publication",
  );
  index.deploymentId = "deployment";
  index.revision = 0;
  if (index.live) index.live.generation = "runtime";
  const roots = { background: index.comparisonUrl, selected: selectedRoots };
  const content = {
    index: { ...index, comparisonUrl: "background/" },
    details,
    bodies,
  };
  return { roots, content };
}
