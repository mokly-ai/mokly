import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { readCatalogue } from "../src/catalogue/reader.js";
import type { RebuildStatus } from "../src/client/rebuild_status.js";
import { renderHydratedShellPage } from "../src/shell/document.js";
import { ShellIdentifierProvider } from "../src/shell/identifier_context.js";
import { RebuildNoticeView } from "../src/shell/rebuild_notice.js";
import { UpdateProgressView } from "../src/shell/update_progress.js";
import { viewerCatalogue, viewerView } from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";
import { renderViewer } from "../src/viewer/server.js";

const model = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v4.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);
const display = viewerCatalogue(model);
const { publicModel: _publicModel, ...privateDisplay } = display;
const DETAIL = [
  "[mokly/build-invalid] could not bundle consumer modules:",
  'entries/home.tsx:3:1: ERROR: <img src=x onerror=alert(1)> **Expected** "}" [link](https://example.com)',
].join("\n");
const failed: RebuildStatus = {
  failure: { detail: DETAIL, id: 3 },
  sequence: 4,
  updateVersion: 4,
  updating: true,
};

function served(
  status?: RebuildStatus,
  screenPath: string | null = "product/browse/home",
) {
  const view = viewerView(display, { ...defaultSelection, screenPath });
  return renderHydratedShellPage(
    view,
    {
      base: "origin/main",
      contentVersion: model.revision.content,
      readModel: model,
      updateVersion: 4,
      ...(status ? { rebuildStatus: status } : {}),
    },
    privateDisplay,
  );
}

function notice(html: string): string {
  const start = html.indexOf('<section aria-labelledby="mb-rebuild-title"');
  assert.notEqual(start, -1, "the notice is rendered");
  return html.slice(start, html.indexOf("</section>", start) + 10);
}

test("a failure at first paint renders the notice between the bar and the body", () => {
  for (const screenPath of [
    null,
    "product/browse/home",
    "components/action",
    "unknown-item",
  ]) {
    const html = served(failed, screenPath);
    const bar = html.indexOf('<header class="mbk-topbar"');
    const barEnd = html.indexOf("</header>", bar);
    const start = html.indexOf('class="mbk-rebuild"');
    assert.ok(bar !== -1 && barEnd < start, `${screenPath} after the bar`);
    assert.ok(start < html.indexOf('class="mbk-body"'), `${screenPath} body`);
    assert.equal(html.split('class="mbk-rebuild"').length, 2);
  }
});

test("the notice names itself by its headline and hides its icon", () => {
  const markup = notice(served(failed));
  assert.match(
    markup,
    /^<section aria-labelledby="mb-rebuild-title" class="mbk-rebuild"><div class="mbk-rebuild-card"><span aria-hidden="true" class="mbk-rebuild-icon"><svg aria-hidden="true"[^>]*width="16"><circle cx="12" cy="12" r="9"><\/circle>/,
  );
  assert.match(
    markup,
    /<div class="mbk-rebuild-copy"><h2 id="mb-rebuild-title">Your latest changes couldn’t be loaded\.<\/h2> <p>You’re seeing the last working version\.<\/p><\/div>/,
  );
  assert.match(
    markup,
    /<details class="mbk-rebuild-details"><summary><span class="mbk-rebuild-label"><span class="mbk-rebuild-show">Show details<\/span><span class="mbk-rebuild-hide">Hide details<\/span><\/span><svg aria-hidden="true"[^>]*width="12"><polyline points="6 9 12 15 18 9"><\/polyline><\/svg><\/summary>/,
  );
  assert.doesNotMatch(markup, /<details[^>]*open/, "details start closed");
  assert.doesNotMatch(markup, /role="(?:alert|status)"|aria-live/);
});

test("the detail is escaped text in a focusable, labelled scroll region", () => {
  const markup = notice(served(failed));
  const detail = markup.match(
    /<pre aria-label="Error details" class="mbk-rebuild-detail" role="region" tabindex="0">([^<]*)<\/pre>/,
  )?.[1];
  assert.equal(
    detail,
    [
      "[mokly/build-invalid] could not bundle consumer modules:",
      "entries/home.tsx:3:1: ERROR: &lt;img src=x onerror=alert(1)&gt; **Expected** &quot;}&quot; [link](https://example.com)",
    ].join("\n"),
  );
  assert.doesNotMatch(markup, /<img|<a |<strong|<script/);
  const headline = markup.slice(0, markup.indexOf("<details"));
  assert.doesNotMatch(headline, /mokly\/build-invalid|entries\/home/);
});

test("progress is never painted at first paint, so it cannot flash", () => {
  for (const status of [
    failed,
    { ...failed, failure: null },
    { ...failed, updating: false },
  ]) {
    const html = served(status);
    assert.doesNotMatch(html, /mbk-progress/);
    assert.match(
      html,
      /<div class="mbk-search-slot"><div class="mbk-search"><svg/,
      "watched Serve gives search and progress one shared allotment",
    );
  }
  assert.doesNotMatch(served({ ...failed, failure: null }), /mbk-rebuild/);
});

test("the status region stays empty at first paint, even with a failure", () => {
  assert.match(
    served(failed),
    /<p aria-atomic="true" aria-live="polite" class="mbk-route-status" id="mb-status" role="status"><\/p>/,
  );
});

test("unwatched Serve, export and embedded viewers carry no status chrome", () => {
  const embedded = renderViewer({
    baseUrl: "https://catalogue.example",
    catalogue: model,
    defaultSelection: { screenPath: "product/browse/home" },
    viewerId: "fixture",
  });
  for (const html of [served(), served(undefined, null), embedded]) {
    assert.doesNotMatch(html, /mbk-search-slot|mbk-rebuild|mbk-progress/);
    assert.match(html, /<div class="mbk-search"><svg/);
  }
});

test("progress is visible text beside a hidden ring, not a live region", () => {
  assert.equal(
    renderToStaticMarkup(<UpdateProgressView />),
    '<span class="mbk-progress"><span aria-hidden="true" class="mbk-progress-spinner"></span>Updating…</span>',
  );
});

test("the notice scopes its identifiers to an embedded shell root", () => {
  const markup = renderToStaticMarkup(
    <ShellIdentifierProvider prefix="viewer-one-">
      <RebuildNoticeView failure={{ detail: "Something failed", id: 2 }} />
    </ShellIdentifierProvider>,
  );
  assert.match(markup, /aria-labelledby="viewer-one-mb-rebuild-title"/);
  assert.match(markup, /<h2 id="viewer-one-mb-rebuild-title">/);
  assert.match(markup, />Something failed<\/pre>/);
});
