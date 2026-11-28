import assert from "node:assert/strict";
import { test } from "node:test";

import type { ViewerError } from "@mokly/viewer";

import { createCatalogueSources } from "../../viewer/source-store";
import type {
  IndexAnswer,
  SourceAccess,
  SourceReads,
  SourceRequest,
} from "../../viewer/source-store";

import {
  bearerAccess,
  cookieAccess,
  packagedIndex,
  publicAccess,
} from "./catalogue-read-fixture";

const publicA: SourceRequest = {
  origin: "https://p-a.example",
  access: publicAccess,
};
const privateA: SourceRequest = { ...publicA, access: cookieAccess() };
const privateB: SourceRequest = {
  ...privateA,
  origin: "https://p-b.example",
};

const version: ViewerError = {
  code: "version",
  message: "This catalogue needs a compatible viewer",
  details:
    "Unsupported Mokly detail version 3; this viewer supports version 4.",
};

/** Reads whose index answers the test settles itself, one per request. */
function heldReads() {
  const answers: Array<{
    request: SourceRequest;
    settle: (answer: IndexAnswer | Error) => void;
  }> = [];
  const detailAccesses: SourceAccess[] = [];
  const reads: SourceReads = {
    index: (request) =>
      new Promise((resolve, reject) => {
        answers.push({
          request,
          settle: (answer) =>
            answer instanceof Error ? reject(answer) : resolve(answer),
        });
      }),
    detail: () => async (access) => {
      detailAccesses.push(access);
      throw new Error("unused detail");
    },
  };
  return { reads, answers, detailAccesses };
}

const settled = () => new Promise((resolve) => setImmediate(resolve));

test("a rebuilt route finds the same source, its index and its detail source", async () => {
  const { reads, answers } = heldReads();
  const store = createCatalogueSources(reads);
  const source = store.select(publicA);
  assert.equal(store.state(source).read.status, "idle");
  store.load(source);
  store.load(source);
  assert.equal(answers.length, 1, "a read in flight is joined");
  answers[0]?.settle({ index: await packagedIndex() });
  await settled();
  const ready = store.state(source).read;
  assert.equal(ready.status, "ready");
  assert.equal(store.select({ ...publicA }), source);
  assert.equal(store.state(source).read, ready);
  store.load(source);
  assert.equal(answers.length, 1, "a read index is never read again");
});

test("a failed index read is read again on the next load", async () => {
  const { reads, answers } = heldReads();
  const store = createCatalogueSources(reads);
  const source = store.select(privateA);
  store.load(source);
  answers[0]?.settle(new Error("missing"));
  await settled();
  assert.deepEqual(store.state(source), { read: { status: "failed" } });
  store.load(source);
  assert.equal(answers.length, 2);
  answers[1]?.settle({ index: await packagedIndex() });
  await settled();
  assert.equal(store.state(source).read.status, "ready");
});

test("an index version failure latches and is never read again", async () => {
  const { reads, answers } = heldReads();
  const store = createCatalogueSources(reads);
  const source = store.select(publicA);
  store.load(source);
  answers[0]?.settle({ failure: { details: version.details } });
  await settled();
  assert.deepEqual(store.state(source).failure, { details: version.details });
  store.load(source);
  assert.equal(answers.length, 1);
});

test("only the first package version error latches, with its diagnostics", () => {
  const store = createCatalogueSources(heldReads().reads);
  const source = store.select(publicA);
  for (const code of [
    "catalogue",
    "selection",
    "frame",
    "comparison",
    "markers",
  ] as const) {
    store.report(source, { code, message: "Failed" });
    assert.equal(store.state(source).failure, undefined, code);
  }
  store.report(source, version);
  store.report(source, { ...version, details: "A later diagnostic" });
  store.report(source, { code: "catalogue", message: "Failed" });
  assert.deepEqual(store.state(source).failure, { details: version.details });

  const plain = createCatalogueSources(heldReads().reads);
  const other = plain.select(publicA);
  plain.report(other, { code: "version", message: version.message });
  assert.deepEqual(plain.state(other).failure, {});
});

test("another origin or policy starts empty and ignores the old source", async () => {
  const { reads, answers } = heldReads();
  const store = createCatalogueSources(reads);
  const publicSource = store.select(publicA);
  store.report(publicSource, version);
  const privateSource = store.select(privateA);
  assert.notEqual(privateSource, publicSource);
  assert.equal(store.state(privateSource).failure, undefined);
  store.report(publicSource, version);
  assert.equal(store.state(privateSource).failure, undefined);

  store.load(privateSource);
  const replacement = store.select(privateB);
  let notified = 0;
  store.subscribe(() => (notified += 1));
  answers[0]?.settle({ index: await packagedIndex() });
  await settled();
  assert.equal(notified, 0, "a replaced source's late answer changes nothing");
  assert.equal(store.state(replacement).read.status, "idle");
  assert.equal(store.state(privateSource).read.status, "idle");
  assert.notEqual(store.select(privateA), privateSource);
});

test("a new document starts with no source and no failure", () => {
  const first = createCatalogueSources(heldReads().reads);
  first.report(first.select(publicA), version);
  const reloaded = createCatalogueSources(heldReads().reads);
  assert.deepEqual(reloaded.state(reloaded.select(publicA)), {
    read: { status: "idle" },
  });
});

test("every state change reaches the subscribers", async () => {
  const { reads, answers } = heldReads();
  const store = createCatalogueSources(reads);
  const source = store.select(publicA);
  const seen: string[] = [];
  const stop = store.subscribe(() =>
    seen.push(store.state(source).read.status),
  );
  store.load(source);
  answers[0]?.settle({ index: await packagedIndex() });
  await settled();
  store.report(source, version);
  stop();
  store.select(privateA);
  assert.deepEqual(seen, ["loading", "ready", "ready"]);
});

test("a retained detail source reads with the new attempt for its origin and policy", async () => {
  const { reads, answers, detailAccesses } = heldReads();
  const store = createCatalogueSources(reads);
  const first = { ...privateA, access: bearerAccess(() => "first") };
  const source = store.select(first);
  store.load(source);
  answers[0]?.settle({ index: await packagedIndex() });
  await settled();
  const ready = store.state(source).read;
  assert.equal(ready.status, "ready");
  const { detail } = ready;
  await assert.rejects(async () => detail("a"), /unused detail/);
  const next = { ...first, access: bearerAccess(() => "next") };
  assert.equal(store.select(next), source);
  assert.equal(store.state(source).read, ready);
  await assert.rejects(async () => detail("a"), /unused detail/);
  assert.equal(detailAccesses.length, 2);
  assert.equal(detailAccesses[0], first.access);
  assert.equal(detailAccesses[1], next.access);
});
