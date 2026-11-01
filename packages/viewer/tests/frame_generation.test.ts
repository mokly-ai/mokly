import assert from "node:assert/strict";
import { test } from "node:test";

import type { ShellCatalogueScreen } from "../src/catalogue/scoped_types.js";
import { dataSnapshot } from "../src/shell/data_commit.js";
import { documentKeyOf } from "../src/shell/document_stage_frame.js";
import {
  nextFrameGeneration,
  type FrameGeneration,
} from "../src/shell/frame_source_hook.js";
import { frameSource, stageDocumentKey } from "../src/shell/stage_sources.js";

import { indexFixture } from "./catalogue_v9_fixture.js";

const KEY = "5".repeat(64);
const NEXT = "6".repeat(64);

const start = (source: string, documentKey?: string): FrameGeneration => ({
  source,
  documentKey,
  generation: 0,
});

test("a frame reloads only when its document key changes at the same source", () => {
  const frame = start("/a", KEY);
  assert.equal(nextFrameGeneration(frame, "/a", KEY), frame);
  assert.deepEqual(nextFrameGeneration(frame, "/a", NEXT), {
    source: "/a",
    documentKey: NEXT,
    generation: 1,
  });
});

test("a source change navigates the same frame element", () => {
  assert.deepEqual(nextFrameGeneration(start("/light", KEY), "/dark", NEXT), {
    source: "/dark",
    documentKey: NEXT,
    generation: 0,
  });
});

test("a frame without a document key never reloads for it", () => {
  assert.equal(
    nextFrameGeneration(start("/preview"), "/preview", KEY).generation,
    0,
  );
  assert.equal(
    nextFrameGeneration(start("/preview", KEY), "/preview", undefined)
      .generation,
    0,
  );
});

test("a publication reloads exactly the frames whose document key changed", () => {
  const before = dataSnapshot(indexFixture(), new Map());
  const after = dataSnapshot(
    indexFixture((raw) => {
      raw.revision = 1;
      raw.screens[1]!.views[0]!.documentKey = NEXT;
    }),
    new Map(),
  );
  const frames = (snapshot: typeof before) =>
    snapshot.catalogue.publicModel.screens.flatMap((screen) =>
      (screen as ShellCatalogueScreen).views.map((view) => ({
        source: frameSource(screen, view)!,
        documentKey: view.documentKey,
      })),
    );
  const reloaded = frames(before).map((frame, at) => {
    const next = frames(after)[at]!;
    return (
      nextFrameGeneration(
        { ...frame, generation: 0 },
        next.source,
        next.documentKey,
      ).generation === 1
    );
  });
  assert.deepEqual(
    reloaded,
    frames(before).map((_, at) => at === 2),
  );
});

test("a page frame follows its key and a document frame its scheme's key", () => {
  const index = indexFixture();
  const page = index.pages[0]!;
  assert.equal(documentKeyOf(page, "dark"), page.documentKey);
  const document = index.documents[0]!;
  assert.equal(
    documentKeyOf(document, "light"),
    document.documentKeys.find((key) => key.colorScheme === "light")
      ?.documentKey,
  );
  assert.equal(
    documentKeyOf(document, "dark"),
    document.documentKeys.find((key) => key.colorScheme === "dark")
      ?.documentKey,
  );
});

test("saved component views supplied by controls reload when their index key changes", () => {
  const index = dataSnapshot(indexFixture(), new Map()).catalogue.publicModel;
  const component = index.components[0]!;
  const saved = component.views[0]!;
  const preview = {
    viewport: saved.viewport,
    colorScheme: saved.colorScheme,
    variantPath: component.path,
    path: "components/button/index.mobile.html",
  };
  const first = start(preview.path, stageDocumentKey(saved, preview));
  const next = nextFrameGeneration(
    first,
    preview.path,
    stageDocumentKey({ ...saved, documentKey: NEXT }, preview),
  );
  assert.equal(first.documentKey, saved.documentKey);
  assert.equal(next.generation, 1);
  const temporary = {
    ...preview,
    path: "/mokly-viewer/components/renders/current/index.html",
  };
  assert.equal(stageDocumentKey(saved, temporary), undefined);
});
