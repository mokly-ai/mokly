import assert from "node:assert/strict";
import { test } from "node:test";

import {
  initialSnapshot,
  type ShellDataSnapshot,
} from "../src/shell/data_commit.js";
import { nextFrameGeneration } from "../src/shell/frame_source_hook.js";
import { frameSource } from "../src/shell/stage_sources.js";

import { detailFixture } from "./catalogue_v9_fixture.js";
import { flush } from "./data_fakes.js";
import {
  changeHomeUsage,
  DOCUMENT_KEY,
  HOME,
  homeDetail,
  homeScreen,
  followPublications,
  publication,
  publish,
  RETIRED,
  USAGE_DETAIL_ID,
  type DetailPair,
} from "./refresh_publication_fixtures.js";

test("a document key publication matches a rebuild and reloads only its frame", async (t) => {
  const shell = followPublications(t);
  await publish(shell.source, publication(1), [homeDetail(1)]);
  const before = screenFrames(shell.controller.snapshot);
  const final = publication(2, (index) => {
    homeScreen(index).views[0]!.documentKey = DOCUMENT_KEY;
  });
  const detail = homeDetail(2);
  await publish(shell.source, final, [detail]);

  shell.matchesRebuild(final, detail);
  const frames = screenFrames(shell.controller.snapshot);
  assert.deepStrictEqual(
    frames,
    screenFrames(initialSnapshot(final, [detail])),
  );
  assert.deepStrictEqual(
    before.map((frame, i) => {
      const { source, documentKey } = frames[i]!;
      return nextFrameGeneration(
        { ...frame, generation: 0 },
        source,
        documentKey,
      ).generation;
    }),
    [1, 0],
  );
  assert.deepStrictEqual(shell.commits, [1, 2]);
});

function screenFrames(snapshot: ShellDataSnapshot) {
  const entry = snapshot.catalogue.publicModel.screens.find(
    ({ path }) => path === HOME,
  )!;
  return entry.views.map((view) => ({
    source: frameSource(entry, view),
    documentKey: view.documentKey,
  }));
}

test("a usage publication matches a rebuild with the new usage", async (t) => {
  const shell = followPublications(t);
  await publish(shell.source, publication(1), [homeDetail(1)]);
  const final = publication(2, (index) => {
    homeScreen(index).detailId = USAGE_DETAIL_ID;
  });
  const detail = homeDetail(2, changeHomeUsage);
  await publish(shell.source, final, [detail]);

  shell.matchesRebuild(final, detail);
  const entry = shell.controller.snapshot.catalogue.byPath.get(HOME);
  assert.equal(
    entry?.kind === "screen" && entry.views[0]!.usage.status,
    "pending",
  );
});

test("a Changes status and mark publication matches a rebuild", async (t) => {
  const shell = followPublications(t);
  const working = publication(1, (index) => {
    index.changesStatus = "pending";
    homeScreen(index).changes = { status: "pending" };
  });
  await publish(shell.source, working, [homeDetail(1)]);
  assert.equal(shell.state().changesStatus, "pending");
  const final = publication(2, (index) => {
    homeScreen(index).changes = {
      status: "ready",
      included: false,
      kind: "unmodified",
    };
  });
  const detail = homeDetail(2);
  await publish(shell.source, final, [detail]);

  shell.matchesRebuild(final, detail);
  assert.equal(shell.state().changesStatus, "ready");
  assert.deepStrictEqual(
    shell.controller.snapshot.catalogue.byPath.get(HOME)?.changes,
    { status: "ready", included: false, kind: "unmodified" },
  );
});

test("a changed removed record matches a rebuild with its held detail", async (t) => {
  const shell = followPublications(
    t,
    `/view/${RETIRED.path}/?snapshot=${RETIRED.snapshotId}`,
  );
  const first: DetailPair = [RETIRED, detailFixture(RETIRED)];
  await publish(shell.source, publication(1), [first]);
  const final = publication(2, (index) => {
    index.removedEntries.find(
      ({ snapshotId }) => snapshotId === RETIRED.snapshotId,
    )!.entry.title = "Retired screen";
  });
  const detail: DetailPair = [RETIRED, detailFixture(RETIRED)];
  await publish(shell.source, final, [detail]);

  shell.matchesRebuild(final, detail);
  assert.equal(
    shell.controller.snapshot.catalogue.byPath.get(RETIRED.path)?.title,
    "Retired screen",
  );
});

for (const change of ["dropped", "renamed"] as const) {
  test(`a ${change} routed entry matches a rebuild and keeps its missing URL`, async (t) => {
    const shell = followPublications(t, "/view/guide/");
    await publish(shell.source, publication(1), [
      [{ path: "guide" }, { ...detailFixture({ path: "guide" }), revision: 1 }],
    ]);
    const final = publication(2, (index) => {
      if (change === "dropped") {
        index.pages = [];
        index.tree = index.tree.filter(({ path }) => path !== "guide");
      } else {
        index.pages[0]!.path = "manual";
        index.pages[0]!.previousPath = "guide";
        index.tree.find(({ path }) => path === "guide")!.path = "manual";
      }
    });
    await publish(shell.source, final);

    shell.matchesRebuild(final);
    assert.deepStrictEqual(shell.state().route.view, {
      kind: "missing",
      requested: "view/guide/",
    });
  });
}

test("an event during an index fetch installs only the newest publication", async (t) => {
  const shell = followPublications(t);
  const first = publication(1);
  shell.source.live!.listener!.message(1, first.deploymentId);
  const pending = shell.source.index();
  const final = publication(2);
  const detail = homeDetail(2);
  await publish(shell.source, final, [detail]);
  assert.equal(pending.signal.aborted, true);
  pending.resolve(first);
  await flush();
  shell.source.details.at(-1)!.resolve(homeDetail(1)[1]);
  await flush();

  shell.matchesRebuild(final, detail);
  assert.deepStrictEqual(shell.commits, [2]);
});

test("an event during a detail fetch installs only the newest publication", async (t) => {
  const shell = followPublications(t);
  const first = publication(1);
  shell.source.live!.listener!.message(1, first.deploymentId);
  shell.source.index().resolve(first);
  await flush();
  const pending = shell.source.detail(HOME);
  const final = publication(2);
  const detail = homeDetail(2);
  await publish(shell.source, final, [detail]);
  assert.equal(pending.signal.aborted, true);
  pending.resolve(homeDetail(1)[1]);
  await flush();

  shell.matchesRebuild(final, detail);
  assert.deepStrictEqual(shell.commits, [2]);
});

test("a later event repairs a failed publication and matches a rebuild", async (t) => {
  const shell = followPublications(t);
  await publish(shell.source, publication(1), [homeDetail(1)]);
  const beforeFailure = shell.controller.snapshot;
  const failed = publication(2);
  shell.source.live!.listener!.message(2, failed.deploymentId);
  shell.source.index().resolve(failed);
  await flush();
  shell.source.detail(HOME).reject(new Error("fetch failed"));
  await flush();
  assert.equal(shell.controller.snapshot, beforeFailure);
  assert.equal(typeof shell.controller.refreshFailed, "string");

  const final = publication(3);
  const detail = homeDetail(3);
  await publish(shell.source, final, [detail]);
  shell.matchesRebuild(final, detail);
  assert.deepStrictEqual(shell.commits, [1, 3]);
});
