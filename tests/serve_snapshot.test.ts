import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

import { MoklyError } from "../dist/errors.js";
import { GitRepositoryEvidence } from "../dist/review/git_evidence.js";
import { configuredServedReview } from "../dist/server/configured_review.js";
import { NodeCatalogueServerFactory } from "../dist/server/factory.js";
import { startCatalogueServer } from "../dist/server/http.js";
import { serve } from "../dist/server/serve.js";

import { observeBackgroundClassification } from "./helpers/background_classification.js";
import { changedFixture } from "./helpers/changed_fixture.js";
import { committedReviewRepository } from "./helpers/committed_repository.js";
import { componentEntrySource } from "./helpers/component_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";
import { documentText } from "./helpers/html.js";

const page = `
import { definePage } from "@mokly/mokly";
mockups.push(definePage({ id: "guide", title: "Guide", route: "guide.html", description: "Guide", dependencies: [], relatedDocs: [], render: () => "<!doctype html><html><body>Guide</body></html>" }));
`;

test("no-watch startup retains removed metadata from its single Changes calculation", async (context) => {
  const fixture = await changedFixture(context, validEntrySource() + page);
  const classified = observeBackgroundClassification(context, fixture.config);
  await fs.writeFile(fixture.entryPath, validEntrySource());
  const mergeBase = GitRepositoryEvidence.prototype.mergeBase;
  let calls = 0;
  context.mock.method(
    GitRepositoryEvidence.prototype,
    "mergeBase",
    async function (
      this: GitRepositoryEvidence,
      ...args: Parameters<typeof mergeBase>
    ) {
      if (++calls > 1)
        throw new Error("history became unavailable after startup");
      return mergeBase.apply(this, args);
    },
  );
  const running = await serve(fixture.config, {
    base: "main",
    port: 0,
    watch: false,
  });
  fixture.beforeRemove(() => running.close());
  await classified;
  const home = await (await fetch(running.url)).text();
  const removed = await fetch(`${running.url}/view/guide.html`);
  assert.equal(removed.status, 200);
  assert.match(documentText(await removed.text()), /Showing previous version/);
  assert.match(home, /data-removed-page=""/);
  assert.match(home, /class="mbk-nav-filter-count">1</);
  assert.equal(calls, 1);
});

test("unavailable startup Changes leaves a complete current catalogue without retrying Git", async (context) => {
  const fixture = await changedFixture(context, validEntrySource() + page);
  await fs.writeFile(fixture.entryPath, validEntrySource());
  let calls = 0;
  context.mock.method(
    GitRepositoryEvidence.prototype,
    "mergeBase",
    async () => {
      calls++;
      throw new MoklyError("git-failed", "history is unavailable");
    },
  );
  const running = await serve(fixture.config, {
    base: "main",
    port: 0,
    watch: false,
  });
  fixture.beforeRemove(() => running.close());
  let home = "";
  for (let attempt = 0; attempt < 100; attempt++) {
    home = await (await fetch(running.url)).text();
    if (home.includes('data-changes-status="unavailable"')) break;
    await setTimeout(50);
  }
  assert.match(home, /data-entry-id="home"/);
  assert.match(home, /data-changes-status="unavailable"/);
  assert.doesNotMatch(home, /data-removed-page/);
  assert.equal((await fetch(`${running.url}/view/guide.html`)).status, 404);
  assert.equal(calls, 1);
});

test("HTTP startup rejects invalid current metadata before querying history", async (context) => {
  const fixture = await changedFixture(context);
  await fs.writeFile(
    path.join(fixture.mockupsDir, ".generated/mokly-manifest.json"),
    "{}",
  );
  let calls = 0;
  context.mock.method(
    GitRepositoryEvidence.prototype,
    "mergeBase",
    async () => {
      calls++;
      throw new Error("invalid current output must fail first");
    },
  );

  await assert.rejects(
    startCatalogueServer(fixture.config, {
      base: "main",
      port: 0,
      review: configuredServedReview(
        fixture.config,
        "main",
        committedReviewRepository(fixture.config),
      ),
    }),
    { code: "manifest-invalid" },
  );
  assert.equal(calls, 0);
});

test("no-watch HTTP startup reuses the catalogue validated before factory handoff", async (context) => {
  const fixture = await changedFixture(context);
  const classified = observeBackgroundClassification(context, fixture.config);
  const start = NodeCatalogueServerFactory.prototype.start;
  context.mock.method(
    NodeCatalogueServerFactory.prototype,
    "start",
    async function (
      this: NodeCatalogueServerFactory,
      ...args: Parameters<typeof start>
    ) {
      await fs.writeFile(
        fixture.entryPath,
        validEntrySource({ firstTitle: "Later catalogue" }),
      );
      return start.apply(this, args);
    },
  );
  const running = await serve(fixture.config, {
    base: "main",
    port: 0,
    watch: false,
  });
  fixture.beforeRemove(() => running.close());
  await classified;
  const home = await (await fetch(running.url)).text();
  assert.doesNotMatch(home, /Later catalogue/);
  assert.match(home, /class="mbk-nav-filter-count">0</);
});

test("a no-watch component catalogue reuses its resolved ownership evidence", async (context) => {
  const source = componentEntrySource() + page;
  const fixture = await changedFixture(context, source);
  const classified = observeBackgroundClassification(context, fixture.config);
  await fs.writeFile(
    fixture.entryPath,
    source.replace(
      "<button data-viewport=",
      '<button className="updated" data-viewport=',
    ),
  );
  const mergeBase = GitRepositoryEvidence.prototype.mergeBase;
  let calls = 0;
  context.mock.method(
    GitRepositoryEvidence.prototype,
    "mergeBase",
    async function (
      this: GitRepositoryEvidence,
      ...args: Parameters<typeof mergeBase>
    ) {
      if (++calls > 1) throw new Error("The baseline must stay pinned");
      return mergeBase.apply(this, args);
    },
  );
  const running = await serve(fixture.config, {
    base: "main",
    port: 0,
    watch: false,
  });
  fixture.beforeRemove(() => running.close());
  await classified;
  const component = await (
    await fetch(`${running.url}/view/components/action.html`)
  ).text();
  assert.match(component, /data-workspace-data/);
  assert.match(component, /"status":"Changed"/);
  assert.match(
    component,
    /data-changed="true"[^>]*data-route="components\/action.html"/,
  );
  assert.equal((await fetch(`${running.url}/view/guide.html`)).status, 200);
  assert.equal(calls, 1);
});
