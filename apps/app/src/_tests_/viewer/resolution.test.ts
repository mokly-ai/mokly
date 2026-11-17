import assert from "node:assert/strict";
import { test } from "node:test";

import { failureRecovery, failureTitle } from "../../viewer/failure";
import {
  newestForBranch,
  publicationState,
  shortSha,
  stageStatus,
  standalonePublication,
} from "../../viewer/resolution";
import { branch, publication } from "./fixtures";

test("standalone entry opens the default branch's newest ready publication", () => {
  assert.equal(
    standalonePublication([branch("main", "p9"), branch("alpha", "p2")]),
    "p9",
  );
  // The default branch has none, so the reference whose own work is newest is
  // opened — not the first by name, which is the order the list arrives in.
  assert.equal(
    standalonePublication([
      branch("main", null),
      branch("alpha", "p2", "2026-09-10T00:00:00Z"),
      branch("zeta", "p7", "2026-09-17T00:00:00Z"),
    ]),
    "p7",
  );
  assert.equal(standalonePublication([branch("main", null)]), undefined);
  assert.equal(standalonePublication([]), undefined);
});

test("only a ready publication with a catalogue mounts one", () => {
  assert.equal(stageStatus(publication()), "ready");
  assert.equal(stageStatus(publication({ catalogueUrl: null })), "unavailable");
  assert.equal(stageStatus(publication({ state: "validating" })), "loading");
  assert.equal(stageStatus(publication({ state: "uploading" })), "loading");
  assert.equal(stageStatus(publication({ state: "expired" })), "unavailable");
  assert.equal(stageStatus(publication({ state: "failed" })), "unavailable");
});

test("a reference row reads its newest attempt, whatever it did", () => {
  const history = [
    publication({ id: "p3", branch: "topic", state: "failed" }),
    publication({ id: "p2", branch: "main" }),
  ];
  assert.equal(newestForBranch(history, "topic")?.id, "p3");
  assert.equal(newestForBranch(history, "main")?.id, "p2");
  assert.equal(newestForBranch(history, "absent"), undefined);
  assert.equal(publicationState(history[0]), "failed");
  assert.equal(publicationState(history[1]), "ready");
  assert.equal(publicationState(publication({ state: "expired" })), "none");
  assert.equal(
    publicationState(publication({ state: "validating" })),
    "publishing",
  );
});

test("a head SHA is recognized by its first seven characters", () => {
  assert.equal(shortSha("76d15b689ce73bad1e39aa6323368134c7785b1e"), "76d15b6");
  assert.equal(shortSha(null), undefined);
});

test("every failure classification offers the reader one action", () => {
  const codes = [
    "invalid-bundle",
    "unsupported-version",
    "too-large",
    "unauthorized",
    "internal",
    "expired",
    "superseded",
  ] as const;
  for (const code of codes) {
    const line = failureRecovery(code);
    assert.ok(line.length > 0 && line.endsWith("."), code);
    // The reviewer's half of the message never carries the developer's nouns.
    for (const internal of ["bundle", "manifest", "inventory", "tarball"]) {
      assert.ok(!line.toLowerCase().includes(internal), `${code}: ${internal}`);
    }
  }
  assert.equal(failureRecovery(null), "Ask a project admin to publish again.");
  assert.equal(failureTitle("main"), "Unable to publish this branch");
  assert.equal(failureTitle(null), "Unable to publish");
});
