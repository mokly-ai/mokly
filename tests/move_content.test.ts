import assert from "node:assert/strict";
import test from "node:test";

import {
  isManifestComponentVariant,
  type ManifestDocument,
} from "@mokly/viewer/data";

import { contentMoveSignals } from "../src/review/moves/content.js";

import { moveReviewFixture as componentReviewFixture } from "./helpers/move_review_fixture.js";

function document(path: string): ManifestDocument {
  return {
    kind: "document",
    path,
    title: path,
    description: "A guide",
    sourcePath: `specs/${path}.md`,
    relatedDocs: [],
    colorSchemes: ["light", "dark"],
    resources: [],
  };
}

test("identical document content requires the complete scheme set while similarity uses authored Markdown", () => {
  const before = document("old");
  const after = document("new");
  const signals = contentMoveSignals(
    [before],
    [after],
    new Map([
      ["mokly-generated/old/index.html", "one\ntwo\nthree\nfour\n"],
      ["mokly-generated/old/index.dark.html", "dark before\n"],
    ]),
    new Map([
      ["mokly-generated/new/index.html", "one\ntwo\nchanged\nlast\n"],
      ["mokly-generated/new/index.dark.html", "unrelated dark after\n"],
    ]),
    {
      before: new Map([[before.sourcePath, "one\ntwo\nthree\nfour\n"]]),
      after: new Map([[after.sourcePath, "one\ntwo\nchanged\nlast\n"]]),
    },
  );
  assert.equal(signals.identical(before, after, []), false);
  assert.equal(signals.similarity(before, after, []), 0.5);
  const lightOnly = { ...after, colorSchemes: ["light"] as const };
  const equalLight = contentMoveSignals(
    [before],
    [lightOnly],
    new Map([
      ["mokly-generated/old/index.html", "same"],
      ["mokly-generated/old/index.dark.html", "same"],
    ]),
    new Map([["mokly-generated/new/index.html", "same"]]),
    {
      before: new Map([[before.sourcePath, "same"]]),
      after: new Map([[after.sourcePath, "same"]]),
    },
  );
  assert.equal(equalLight.identical(before, lightOnly, []), false);
  assert.equal(equalLight.similarity(before, lightOnly, []), 1);
});

test("identical component content requires evidence for every variant, not only schema and slugs", async (t) => {
  const source =
    "import {defineComponent} from '@mokly/mokly'; export default defineComponent({path:'old/action',title:'Action',description:'An action',relatedDocs:[],propSchema:{kind:'object',properties:{}},render:()=> <button>Continue</button>,variants:[{slug:'primary',title:'Primary',props:{}}]});";
  const fixture = await componentReviewFixture(
    t,
    (text) =>
      text
        .replace("old/action", "new/action")
        .replace(
          "<button>Continue</button>",
          "<aside>Unrelated information</aside>",
        ),
    source,
  );
  const text = (outputs: typeof fixture.before.outputs) =>
    new Map(
      [...outputs].flatMap(([route, content]) =>
        typeof content === "string"
          ? [[`mokly-generated/${route}`, content] as const]
          : [],
      ),
    );
  const signals = contentMoveSignals(
    fixture.before.manifest.entries,
    fixture.after.manifest.entries,
    text(fixture.before.outputs),
    text(fixture.after.outputs),
  );
  const before = fixture.before.manifest.entries.find(
    (entry) => entry.kind === "component" && !isManifestComponentVariant(entry),
  )!;
  const after = fixture.after.manifest.entries.find(
    (entry) => entry.kind === "component" && !isManifestComponentVariant(entry),
  )!;
  assert.equal(signals.identical(before, after, []), false);
  assert.equal(
    signals.identical(before, after, [
      {
        kind: "component",
        path: "new/action/primary",
        previousPath: "old/action/primary",
      },
    ]),
    true,
  );
});
