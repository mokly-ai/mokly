import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiError } from "../../api/errors";
import { chromeSubject } from "../../screens/viewer/subject";
import { emptyLog } from "../../viewer/build-log";
import { build, buildPullRequest } from "./build-fixtures";
import { publication, pullRequest } from "./fixtures";

const resolved = { kind: "publication" as const, publication: publication() };

/** The observation the API returns on a publication that came from a review. */
const observed = {
  number: 42,
  title: "Name the pull request",
  author: "octocat",
  url: "https://github.com/mokly-ai/mokly-cloud/pull/42",
};

test("a publication address names the pull request the publication carries", () => {
  const withPull = publication({ pullRequest: observed });
  const subject = chromeSubject({
    entry: { kind: "publication", publication: withPull },
    publication: withPull,
  });
  assert.equal(subject.label, "#42 Name the pull request");
  assert.equal(subject.author, "octocat");
  assert.equal(
    subject.pullRequestUrl,
    "https://github.com/mokly-ai/mokly-cloud/pull/42",
  );
  // The reference is still the branch, which is what history and the poll ask.
  assert.deepEqual(subject.ref, { kind: "branch", name: "main" });
});

test("the publication's own pull request wins over the address's", () => {
  const withPull = publication({ pullRequest: observed });
  const subject = chromeSubject({
    entry: { kind: "publication", publication: withPull },
    publicationRef: { kind: "pull-request", number: 4 },
    publication: withPull,
    pullRequest: pullRequest(),
  });
  assert.equal(subject.label, "#42 Name the pull request");
});

test("an observation with no author leaves the author out", () => {
  const withPull = publication({
    pullRequest: { ...observed, author: null },
  });
  const subject = chromeSubject({
    entry: { kind: "publication", publication: withPull },
    publication: withPull,
  });
  assert.equal(subject.author, undefined);
  assert.equal(subject.label, "#42 Name the pull request");
});

test("an alias with nothing published keeps the reference's own name", () => {
  // A pull request that has never published has no publication to read, so the
  // address stays named by the observation the alias itself read.
  const subject = chromeSubject({
    entry: { kind: "unpublished", closed: undefined, fork: false },
    publicationRef: { kind: "pull-request", number: 4 },
    pullRequest: pullRequest(),
  });
  assert.equal(subject.label, "#4 Host the viewer");
  assert.equal(subject.author, "octocat");
  assert.equal(subject.unpublished, true);
});

test("a publication with no pull request is named by its branch", () => {
  const subject = chromeSubject({
    entry: resolved,
    publication: resolved.publication,
  });
  assert.equal(subject.label, "main");
  assert.equal(subject.author, undefined);
  assert.equal(subject.pullRequestUrl, undefined);
});

test("a build address names This build until its build is read", () => {
  const entry = { kind: "build" as const, buildId: "b1", route: true };
  const loading = chromeSubject({ entry, build: { status: "loading" } });
  assert.equal(loading.label, "This build");
  assert.deepEqual(loading.status, { state: "none", detail: "Loading" });
  const error = new ApiError({
    code: "not-found",
    reason: "not-found",
    message: "Not found.",
    requestId: "request-1",
    status: 404,
  });
  const missing = chromeSubject({ entry, build: { status: "missing", error } });
  assert.equal(missing.label, "This build");
  assert.deepEqual(missing.status, {
    state: "failed",
    detail: "Build unavailable",
  });
  const unreadable = chromeSubject({
    entry,
    build: { status: "error", error },
  });
  assert.deepEqual(unreadable.status, {
    state: "failed",
    detail: "Build couldn’t load",
  });
});

test("a read build names its own pull request, author and state", () => {
  const subject = chromeSubject({
    entry: { kind: "build", buildId: "b1", route: true },
    build: {
      status: "ready",
      build: build({ pullRequest: buildPullRequest }),
      log: emptyLog,
    },
  });
  assert.equal(subject.label, "#14 Host the catalogue");
  assert.equal(subject.author, "octocat");
  assert.equal(subject.pullRequestUrl, buildPullRequest.url);
  assert.deepEqual(subject.ref, { kind: "pull-request", number: 14 });
  assert.deepEqual(subject.status, {
    state: "publishing",
    detail: "Publishing now",
  });
});

test("a reference showing its build keeps the reference's own name", () => {
  const subject = chromeSubject({
    entry: { kind: "build", buildId: "b1", route: false },
    publicationRef: { kind: "branch", name: "topic" },
    build: { status: "loading" },
  });
  assert.equal(subject.label, "topic");
  assert.deepEqual(subject.ref, { kind: "branch", name: "topic" });
});

test("an entry that nothing names yet leaves its trigger to the placeholder", () => {
  // The standalone address names no reference: nothing names one while its
  // entry resolves, while it redirects to the publication it found, or while
  // the build it found is read.
  for (const entry of [
    { kind: "loading" as const },
    { kind: "redirect" as const, publicationId: "p1" },
  ])
    assert.equal(chromeSubject({ entry }).label, undefined, entry.kind);
  assert.equal(
    chromeSubject({
      entry: { kind: "build", buildId: "b1", route: false },
      build: { status: "loading" },
    }).label,
    undefined,
  );
  // An alias's own address names its reference while the alias resolves.
  assert.equal(
    chromeSubject({
      entry: { kind: "loading" },
      publicationRef: { kind: "branch", name: "topic" },
    }).label,
    "topic",
  );
  assert.equal(
    chromeSubject({
      entry: { kind: "redirect", publicationId: "p1" },
      publicationRef: { kind: "pull-request", number: 4 },
    }).label,
    "#4",
  );
});

test("a standalone entry with nothing ready names the branch it would publish", () => {
  const subject = chromeSubject({
    entry: {
      kind: "unpublished",
      reference: { kind: "branch", name: "main" },
      closed: undefined,
      fork: false,
    },
  });
  assert.equal(subject.label, "main");
  assert.equal(
    chromeSubject({
      entry: { kind: "unpublished", closed: undefined, fork: false },
    }).label,
    "This project",
  );
});
