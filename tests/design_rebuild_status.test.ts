import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { entryRoute } from "@mokly/viewer/data";

import { REBUILD_DETAIL } from "../examples/basic/entries/design/parts/rebuild_status.js";

import {
  attribute,
  byClass,
  designCatalogue,
  designDocument,
  elements,
  textContent,
  type Element,
} from "./helpers/design_catalogue.js";
import {
  NOTICE_COPY,
  PROGRESS_COPY,
  REBUILD_STATES,
  TECHNICAL_WORDS,
} from "./helpers/design_rebuild_status.js";
import { repositoryRoot } from "./helpers/fixture.js";

/** Element children in document order, skipping text and marker comments. */
function children(node: Element): Element[] {
  return node.childNodes.filter(
    (child): child is Element => "tagName" in child,
  );
}

function firstClass(node: Element): string | undefined {
  return (attribute(node, "class") ?? "").split(/\s+/u)[0];
}

/** Containers that hold a depicted preview, which the notice never enters. */
const PREVIEW_REGIONS = [
  "mbk-stage",
  "ce-preview-pane",
  "phone-screen",
  "browser-viewport",
  "ce-canvas",
];

test("Update status owns the five approved light-only states", async () => {
  const { manifest } = await designCatalogue;
  assert.deepEqual(
    manifest.entries
      .filter(
        (entry) =>
          entry.kind === "screen" && entry.navPath.at(-1) === "Update status",
      )
      .map(({ id }) => id)
      .sort(),
    REBUILD_STATES.map(({ id }) => id).sort(),
  );
  assert.equal(REBUILD_STATES[0]?.id, "design-rebuild-failure");
  for (const state of REBUILD_STATES) {
    const entry = manifest.entries.find((entry) => entry.id === state.id);
    assert.ok(entry?.kind === "screen", state.id);
    assert.equal(entryRoute("screen", entry.id), `screens/${state.id}.html`);
    assert.deepEqual(entry.colorSchemes, ["light"], state.id);
  }
});

test("the disclosed detail is one bounded, sanitized, repository-relative diagnostic", () => {
  assert.ok(REBUILD_DETAIL.includes("\n"), "line breaks are preserved");
  assert.ok([...REBUILD_DETAIL].length <= 2048);
  assert.ok(Buffer.byteLength(REBUILD_DETAIL, "utf8") <= 8192);
  assert.ok(
    [...REBUILD_DETAIL].every((character) => {
      const code = character.codePointAt(0) ?? 0;
      return (
        character === "\n" || (code >= 0x20 && (code < 0x7f || code > 0x9f))
      );
    }),
    "no ANSI styling or other control characters",
  );
  assert.doesNotMatch(
    REBUILD_DETAIL,
    /(?:^|[\s"'(])(?:\/[^\s/]|[A-Za-z]:[\\/]|\\\\|file:)/mu,
    "no absolute filesystem path",
  );
  assert.doesNotMatch(REBUILD_DETAIL, /<[a-z][^>]*>/iu, "no markup");
  assert.ok(
    REBUILD_DETAIL.split(/\s+/u).some((token) => token.length > 44),
    "one token is long enough to wrap at narrow widths",
  );
});

test("the approved copy never names builds, bundles or other internals", () => {
  for (const copy of [...Object.values(NOTICE_COPY), PROGRESS_COPY])
    assert.doesNotMatch(copy, TECHNICAL_WORDS, copy);
});

test("the design contract records exactly the copy the mockups render", async () => {
  const contract = await fs.readFile(
    path.join(repositoryRoot, "docs/protocol/mokly-rebuild-status-design.md"),
    "utf8",
  );
  for (const copy of [...Object.values(NOTICE_COPY), PROGRESS_COPY])
    assert.ok(contract.includes(`**${copy}**`), copy);
});

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: the notice sits directly below the top bar, outside every preview`, async () => {
    for (const state of REBUILD_STATES) {
      const { document } = await designDocument(state.id, viewport);
      assert.equal(
        elements(document, (node) => node.tagName === "script").length,
        0,
      );
      const shells = byClass(document, "mbk-shell");
      assert.equal(shells.length, 1, state.id);
      const expected = [
        "mbk-topbar",
        ...(state.notice ? ["mbk-rebuild"] : []),
        viewport === "desktop" ? "mbk-body" : "mbk-main",
      ];
      assert.deepEqual(
        children(shells[0]!).slice(0, expected.length).map(firstClass),
        expected,
        state.id,
      );
      assert.equal(
        byClass(document, "mbk-rebuild").length,
        state.notice ? 1 : 0,
      );
      for (const region of PREVIEW_REGIONS)
        for (const node of byClass(document, region))
          assert.equal(byClass(node, "mbk-rebuild").length, 0, region);
    }
  });

  test(`${viewport}: the notice is a region named by its heading, with the approved copy`, async () => {
    for (const state of REBUILD_STATES.filter(({ notice }) => notice)) {
      const { document } = await designDocument(state.id, viewport);
      const notice = byClass(document, "mbk-rebuild")[0]!;
      assert.equal(notice.tagName, "section");
      const heading = elements(notice, (node) => node.tagName === "h2")[0];
      assert.ok(heading, state.id);
      assert.equal(
        attribute(notice, "aria-labelledby"),
        attribute(heading, "id"),
      );
      assert.equal(textContent(heading), NOTICE_COPY.headline);
      const explanation = elements(
        byClass(notice, "mbk-rebuild-copy")[0]!,
        (node) => node.tagName === "p",
      );
      assert.deepEqual(explanation.map(textContent), [NOTICE_COPY.explanation]);
      const icon = byClass(notice, "mbk-rebuild-icon")[0]!;
      assert.equal(attribute(children(icon)[0]!, "aria-hidden"), "true");
      assert.equal(
        elements(
          notice,
          (node) =>
            attribute(node, "aria-live") !== undefined ||
            ["alert", "status"].includes(attribute(node, "role") ?? ""),
        ).length,
        0,
        "the shell's status region announces a failure, not the notice",
      );
    }
  });

  test(`${viewport}: the disclosure opens only in the details state and names its action`, async () => {
    for (const state of REBUILD_STATES.filter(({ notice }) => notice)) {
      const { document } = await designDocument(state.id, viewport);
      const details = byClass(document, "mbk-rebuild-details")[0];
      assert.ok(details?.tagName === "details", state.id);
      assert.equal(
        attribute(details, "open") !== undefined,
        state.notice === "open",
        state.id,
      );
      const [summary] = children(details);
      assert.equal(summary?.tagName, "summary");
      assert.equal(
        textContent(byClass(summary, "mbk-rebuild-show")[0]!),
        NOTICE_COPY.show,
      );
      assert.equal(
        textContent(byClass(summary, "mbk-rebuild-hide")[0]!),
        NOTICE_COPY.hide,
      );
      const detail = byClass(details, "mbk-rebuild-detail")[0]!;
      assert.equal(detail.tagName, "pre");
      assert.equal(children(detail).length, 0, "the detail is text only");
      assert.equal(textContent(detail), REBUILD_DETAIL);
    }
  });

  test(`${viewport}: progress shows only while updating, as quiet text beside search`, async () => {
    for (const state of REBUILD_STATES) {
      const { document } = await designDocument(state.id, viewport);
      const bar = byClass(document, "mbk-topbar")[0]!;
      const progress = byClass(bar, "mbk-progress");
      assert.equal(progress.length, state.updating ? 1 : 0, state.id);
      assert.equal(byClass(document, "mbk-progress").length, progress.length);
      const slot = byClass(bar, "mbk-search-slot")[0];
      assert.equal(slot !== undefined, state.updating, state.id);
      if (!slot) continue;
      assert.equal(textContent(progress[0]!), PROGRESS_COPY);
      const spinner = byClass(progress[0]!, "mbk-progress-spinner")[0]!;
      assert.equal(attribute(spinner, "aria-hidden"), "true");
      assert.deepEqual(children(slot).map(firstClass), [
        "mbk-search",
        "mbk-progress",
      ]);
      const items = children(bar);
      assert.equal(
        firstClass(items[items.indexOf(slot) + 1]!),
        "mbk-appearance",
        "progress sits between the search field and Appearance",
      );
      assert.equal(
        elements(
          bar,
          (node) =>
            attribute(node, "aria-live") !== undefined ||
            attribute(node, "role") === "status",
        ).length,
        0,
        "progress is visible text, not an announcement",
      );
    }
  });
}
