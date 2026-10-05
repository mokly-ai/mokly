import assert from "node:assert/strict";
import test from "node:test";

import { acceptedGenerationFromCompilation } from "../dist/review/accepted_generation.js";
import { readCatalogueChanges } from "../dist/server/component_changes.js";
import { contentMoveSignals } from "../src/review/moves/content.js";
import { readMoveMarkdown } from "../src/review/moves/markdown_sources.js";
import { visiblePageText } from "../src/review/moves/visible_text.js";

import { movedCatalogueFixture } from "./helpers/move_catalogue.js";

test("page similarity uses visible body block lines and excludes template and hidden text", () => {
  const html =
    '<!doctype html><html><head><title>Generated</title><style>p{color:red}</style></head><body><h1>A <em>title</em></h1><p>One &amp; two<br>Next line</p><ul><li>First</li><li>Second</li></ul><table><tr><td>A</td><td>B</td></tr></table><aside hidden>Hidden</aside><div aria-hidden="true">Hidden</div><script>code()</script><template>Template</template></body></html>';
  assert.equal(
    visiblePageText(html),
    "A title\nOne & two\nNext line\nFirst\nSecond\nA B",
  );
});

test("page similarity ignores matching generated head and raw markup formatting", () => {
  const page = (path: string) => ({
    kind: "page" as const,
    path,
    sourcePath: `${path}.ts`,
    title: path,
    description: "Page",
    declaredDependencies: [],
    relatedDocs: [],
  });
  const before = page("old"),
    after = page("new");
  const signal = (left: string, right: string) =>
    contentMoveSignals(
      [before],
      [after],
      new Map([["mokly-generated/old/index.html", left]]),
      new Map([["mokly-generated/new/index.html", right]]),
    );
  assert.equal(
    signal(
      "<head><title>Same</title></head><p>A</p><p>B</p>",
      "<head><title>Same</title></head><div>X</div><div>Y</div>",
    ).similarity(before, after, []),
    0,
  );
  assert.equal(
    signal("<p>A</p><p>B</p>", "<div>A</div><div>C</div>").similarity(
      before,
      after,
      [],
    ),
    0.5,
  );
  assert.equal(
    signal(
      "<head><title>Same</title></head>",
      "<head><title>Same</title></head>",
    ).similarity(before, after, []),
    0,
  );
});

test("Markdown similarity retains accepted body bytes after the source changes", async (t) => {
  const fixture = await movedCatalogueFixture(t, { edited: true });
  const generation = acceptedGenerationFromCompilation(fixture.after);
  await fixture.write(
    "specs/new/guide.md",
    "# Unrelated\n\nThis source belongs to a later generation.",
  );
  const snapshot = await readCatalogueChanges(
    fixture.config,
    fixture.after.manifest,
    "main",
    fixture.git,
    "a".repeat(40),
    generation,
  );
  assert.ok(snapshot.pairing?.moves.some((move) => move.path === "new/guide"));
  assert.ok(snapshot.changedEntries?.includes("new/guide"));
  assert.ok(snapshot.comparison?.headOutputs?.length);
  const { headOutputs: _rendered, ...comparison } = snapshot.comparison!;
  assert.ok(
    !JSON.stringify({ ...snapshot, comparison }).includes(
      "Read the updated guide.",
    ),
  );
  assert.equal(Object.hasOwn(snapshot, "documentMarkdown"), false);
  assert.equal(Object.hasOwn(comparison, "documentMarkdown"), false);
});

test("an incomplete accepted body map never falls back to a later filesystem generation", async (t) => {
  const fixture = await movedCatalogueFixture(t, { edited: true });
  const sources = await readMoveMarkdown(
    fixture.before.manifest,
    fixture.after.manifest,
    fixture.config,
    fixture.git.reader,
    "a".repeat(40),
    new Map(),
  );
  assert.equal(sources.after.size, 0);
  assert.ok(
    sources.before.get("specs/old/guide.md")?.includes("Read the guide."),
  );
});

test("page body source wrapping does not create similarity lines", () => {
  assert.equal(
    visiblePageText(
      "<p>One\n  sentence <em>with\n emphasis</em>.</p><pre>a\nb</pre>",
    ),
    "One sentence with emphasis.\na\nb",
  );
});
