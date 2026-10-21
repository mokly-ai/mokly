import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { MoklyVersionError } from "../src/catalogue/version_error.js";
import { ComparisonFailure, reviewReload } from "../src/shell/diffs.js";
import { MoklyViewer } from "../src/viewer/component.js";
import { loadIndexSource, sourceUrl } from "../src/viewer/sources.js";

import {
  detailPairs,
  rawDetailFixtures,
  rawIndexFixture,
} from "./catalogue_v7_fixture.js";
import {
  embeddedMarkup,
  heldEmbeddedMarkup,
} from "./presentation_v7_helpers.js";
import { htmlIds, htmlReferences } from "./shell_markup.js";

const fixture = rawIndexFixture();

test("the embedded viewer renders the public fixture, default state and every host slot", () => {
  const html = embeddedMarkup({
    slots: {
      topBarStart: <button>Start</button>,
      topBarEnd: <button>End</button>,
      railStart: <p>Above</p>,
      railEnd: <p>Below</p>,
      sidePanel: { content: <p>Discussion</p>, width: 320 },
      stageOverlay: { content: <span>Annotation</span>, pointerEvents: "none" },
      emptyState: <p>Choose your screen</p>,
    },
  });
  for (const text of [
    "Start",
    "End",
    "Above",
    "Below",
    "Discussion",
    "Annotation",
    "Choose your screen",
  ])
    assert.ok(html.includes(text));
  assert.match(html, /width:320px/);
  assert.match(html, /pointer-events:none/);
  assert.doesNotMatch(html, /<script|Pick components/);
});

for (const screenPath of [
  null,
  ...fixture.screens.map((entry) => entry.path),
  ...fixture.components.map((entry) => entry.path),
  "unknown-item",
])
  test(`the embedded viewer renders ${screenPath ?? "the catalogue home"} from catalogue data`, () => {
    const html = embeddedMarkup({ defaultSelection: { screenPath } });
    assert.match(html, /data-mokly-shell/);
    if (screenPath === "unknown-item") {
      assert.match(
        html,
        /<h2>Item not found<\/h2><p>Nothing in the catalogue matches <code>unknown-item<\/code><\/p><a class="mbk-empty-link" href="\/">Go to the catalogue home<\/a>/,
      );
      assert.doesNotMatch(html, /mokly build|renamed or removed/);
    } else if (screenPath) {
      // The first render waits for the entry's detail; its frames follow it.
      assert.match(html, /aria-busy="true"[^>]*><p role="status">Loading/);
      assert.doesNotMatch(html, /<iframe/);
      assert.match(
        heldEmbeddedMarkup({ selection: { screenPath } }),
        /src="https:\/\/catalogue.example\/static\//,
      );
    }
  });

test("an object source requires a valid base and a URL source rejects an override", async () => {
  const { signal } = new AbortController();
  await assert.rejects(loadIndexSource(rawIndexFixture(), undefined, signal));
  await assert.rejects(
    loadIndexSource(
      "https://example.test/catalogue.json",
      "https://override.test",
      signal,
    ),
  );
  for (const value of [
    "file:///catalogue.json",
    "/relative.json",
    "https://user:pass@example.test/",
    "https://example.test/#secret",
  ])
    assert.throws(() => sourceUrl(value));
  assert.equal(
    (
      await loadIndexSource(
        rawIndexFixture(),
        "https://example.test/nested",
        signal,
      )
    ).root.href,
    "https://example.test/",
  );
});

test("the embedded viewer renders its default selection and host slots", () => {
  const selection = {
    screenPath: fixture.screens[0]!.path,
    viewport: "mobile",
    colorScheme: "dark",
    search: "TAG:forms phrase",
  } as const;
  const html = embeddedMarkup({
    defaultSelection: selection,
    slots: { topBarEnd: <b>Account</b> },
  });
  assert.match(html, /<b>Account<\/b>/);
  assert.match(html, /data-mokly-color-scheme="dark"/);
  assert.match(html, /<option value="mobile" selected="">/);
  assert.match(html, /value="phrase tag:forms"/);
  // The selected viewport reaches the stage once the entry's detail is held.
  assert.match(heldEmbeddedMarkup({ selection }), /data-viewport="mobile"/);
});

/** The prefix every id of one root carries: its main region's id less `mb-main`. */
function rootPrefix(ids: ReadonlySet<string>): string {
  const main = [...ids].find((id) => id.endsWith("mb-main"));
  assert.ok(main, "the root has a main region");
  return main.slice(0, -"mb-main".length);
}

test("independent embedded viewers keep IDs and references root-local", () => {
  const render = (identifierPrefix: string) =>
    embeddedMarkup({
      defaultSelection: { screenPath: fixture.components[0]!.path },
      identifierPrefix,
    });
  const first = render("primary");
  const second = render("secondary");
  const firstIds = htmlIds(first);
  const secondIds = htmlIds(second);

  assert.ok(firstIds.size > 0);
  const firstPrefix = rootPrefix(firstIds);
  const secondPrefix = rootPrefix(secondIds);
  assert.match(firstPrefix, /^mokly-.*primary/);
  assert.match(secondPrefix, /^mokly-.*secondary/);
  assert.ok([...firstIds].every((id) => id.startsWith(firstPrefix)));
  assert.ok([...secondIds].every((id) => id.startsWith(secondPrefix)));
  assert.deepEqual(
    [...firstIds].filter((id) => secondIds.has(id)),
    [],
  );
  assert.ok(htmlReferences(first).every((id) => firstIds.has(id)));
  assert.ok(htmlReferences(second).every((id) => secondIds.has(id)));
});

test("distinct identifier prefixes keep roots apart; published props have no fields", () => {
  const index = rawIndexFixture();
  const details = rawDetailFixtures();
  const component = index.components[0]!;
  if (component.variantOf !== undefined)
    throw new Error("Missing component parent");
  for (const entry of index.components.filter(
    ({ path, variantOf }) =>
      path === component.path || variantOf === component.path,
  )) {
    entry.controls = { ...entry.controls, "mb-main": entry.controls.label! };
    entry.propSchema = {
      ...entry.propSchema,
      properties: {
        ...entry.propSchema.properties,
        "mb-main": entry.propSchema.properties!.label!,
      },
    };
    entry.props = { ...entry.props, "mb-main": entry.props.label! };
    // Its detail declares the added control too, so the shell holds it.
    const detail = details.current[entry.path]!;
    detail.controlOrder = [...detail.controlOrder!, "mb-main"];
  }
  const markup = (identifierPrefix: string) =>
    embeddedMarkup({
      index,
      defaultSelection: { screenPath: component.path },
      identifierPrefix,
    });
  const first = markup("x");
  const firstIds = htmlIds(first);
  const secondIds = htmlIds(markup("x-mb-prop-action"));
  // Until the routed detail arrives, the viewer's Props show no fields.
  assert.match(
    first.slice(
      first.indexOf('data-inspector-panel="props"'),
      first.indexOf('data-inspector-panel="usage"'),
    ),
    /<p role="status">Loading props…<\/p>/,
  );

  // Props wait for the routed detail, so a render that holds it shows them.
  const held = heldEmbeddedMarkup({
    index,
    details: detailPairs(undefined, details),
    selection: { screenPath: component.path },
  });
  const props = held.slice(
    held.indexOf('data-inspector-panel="props"'),
    held.indexOf('data-inspector-panel="usage"'),
  );
  assert.match(
    props,
    /<h3 tabindex="-1">Saved props<\/h3><p>Action<\/p><\/div><\/div><p class="mbk-controls-notice">Open this catalogue locally to edit props\.<\/p>/,
  );
  assert.match(props, /<dt>mb-main<\/dt>/);
  assert.doesNotMatch(props, /<input|<select|mb-prop-/);
  assert.deepEqual(
    [...firstIds].filter((id) => secondIds.has(id)),
    [],
  );
});

test("an index of another version shows the version headline without an action", () => {
  const index = { ...fixture, schemaVersion: 8 } as unknown as typeof fixture;
  const html = embeddedMarkup({ index });
  assert.match(
    html,
    /role="alert"[^>]*><h2>This catalogue needs a compatible viewer<\/h2><\/div>/,
  );
  assert.doesNotMatch(html, /<button|Try again|Reload/);
});

test("an index that cannot be read offers Try again under its headline", () => {
  const index = { ...fixture, tree: "not a tree" } as unknown as typeof fixture;
  const html = embeddedMarkup({ index });
  assert.match(
    html,
    /<h2>The catalogue could not be loaded<\/h2><button class="mbk-empty-link" type="button">Try again<\/button>/,
  );
});

test("the embedded viewer is one busy status line while its index loads", () => {
  const html = renderToStaticMarkup(
    <MoklyViewer
      detail={(path) => `https://catalogue.example/entries/${path}.json`}
      index="https://catalogue.example/mokly-viewer/index.json"
    />,
  );
  assert.match(
    html,
    /^<div aria-busy="true" class="mokly-viewer mbk-empty" tabindex="-1"[^>]*><p role="status">Loading catalogue…<\/p><\/div>$/,
  );
});

test("a rejected review shows the headline; only the standalone shell offers Reload", () => {
  const failure = (reload?: () => void) =>
    renderToStaticMarkup(
      <ComparisonFailure
        details="Unsupported Mokly review version 9; this viewer supports version 8."
        {...(reload ? { reload } : {})}
        retry={() => undefined}
        versionError={new MoklyVersionError("review", 9, 8)}
      />,
    );
  assert.match(
    failure(),
    /^<p role="alert">This catalogue needs a compatible viewer<\/p><details data-comparison-failure="">/,
  );
  assert.match(
    failure(() => undefined),
    /^<p role="alert">This catalogue needs a compatible viewer <button class="mbk-empty-link" data-diff-reload="" type="button">Reload<\/button><\/p>/,
  );
  assert.doesNotMatch(
    failure(() => undefined),
    /Try again/,
  );
  assert.match(
    renderToStaticMarkup(
      <ComparisonFailure details="offline" retry={() => undefined} />,
    ),
    /^<p>The comparison could not be loaded\. <button class="mbk-empty-link" data-diff-refresh="" type="button">Try again<\/button><\/p>/,
  );
});

test("only the standalone shell's context offers Reload for a rejected review", () => {
  const reload = () => undefined;
  assert.equal(reviewReload({ embedded: false }, reload), reload);
  assert.equal(reviewReload({ embedded: true }, reload), undefined);
  assert.equal(reviewReload(undefined, reload), undefined);
});
