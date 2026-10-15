import assert from "node:assert/strict";
import { test } from "node:test";

import { loadIndexSource, sourceUrl } from "../src/viewer/sources.js";

import { rawIndexFixture } from "./catalogue_v7_fixture.js";
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
    if (screenPath === "unknown-item") assert.match(html, /Item not found/);
    else if (screenPath) {
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

test("distinct identifier prefixes cannot absorb dynamic control IDs", () => {
  const index = rawIndexFixture();
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
  }
  const render = (identifierPrefix: string) =>
    htmlIds(
      embeddedMarkup({
        index,
        defaultSelection: { screenPath: component.path },
        identifierPrefix,
      }),
    );
  const firstIds = render("x");
  const secondIds = render("x-mb-prop-action");

  assert.ok(
    [...firstIds].some((id) =>
      id.endsWith(`mb-prop-${component.path}-mb-main`),
    ),
  );
  assert.deepEqual(
    [...firstIds].filter((id) => secondIds.has(id)),
    [],
  );
});
