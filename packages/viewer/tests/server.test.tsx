import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { readCatalogue } from "../src/catalogue/reader.js";
import { renderViewer } from "../src/viewer/server.js";
import { catalogueUrl, readObjectSource } from "../src/viewer/source.js";

const fixture = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);

test("SSR renders the public fixture, default state and every host slot", () => {
  const html = renderViewer({
    catalogue: fixture,
    baseUrl: "https://catalogue.example",
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
for (const screenId of [
  null,
  ...fixture.screens.map((entry) => entry.id),
  ...fixture.components.map((entry) => entry.id),
  "unknown-item",
])
  test(`SSR renders ${screenId ?? "home"} from catalogue data`, () => {
    const html = renderViewer({
      catalogue: fixture,
      baseUrl: "https://catalogue.example",
      defaultSelection: { screenId },
    });
    assert.match(html, /data-mokly-shell/);
    if (screenId === "unknown-item") assert.match(html, /Item not found/);
    else if (screenId)
      assert.match(html, /src="https:\/\/catalogue.example\/static\//);
  });

test("object source requires a valid base and URL sources reject an override", () => {
  assert.throws(() => readObjectSource(fixture));
  assert.throws(() =>
    readObjectSource(
      "https://example.test/catalogue.json",
      "https://override.test",
    ),
  );
  for (const value of [
    "file:///catalogue.json",
    "/relative.json",
    "https://user:pass@example.test/",
    "https://example.test/#secret",
  ])
    assert.throws(() => catalogueUrl(value));
  assert.equal(
    readObjectSource(fixture, "https://example.test/nested")?.url.href,
    "https://example.test/",
  );
});

test("SSR and initial React render agree for selection and all slots", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { MoklyViewer } = await import("../src/viewer/component.js");
  const props = {
    catalogue: fixture,
    baseUrl: "https://catalogue.example",
    defaultSelection: {
      screenId: fixture.screens[0]!.id,
      viewport: "mobile" as const,
      colorScheme: "dark" as const,
      search: "TAG:forms phrase",
    },
    slots: { topBarEnd: <b>Account</b> },
  };
  const html = renderViewer(props);
  assert.equal(renderToStaticMarkup(<MoklyViewer {...props} />), html);
  assert.match(html, /data-mokly-color-scheme="dark"/);
  assert.match(html, /data-viewport="mobile"/);
  assert.match(html, /value="phrase tag:forms"/);
});

test("invalid current paths are rejected instead of replaced with guessed URLs", () => {
  const model = structuredClone(fixture);
  const screen = model.screens[0]!;
  for (const view of screen.views) view.fragmentPath = null;
  assert.throws(() =>
    renderViewer({
      catalogue: model,
      baseUrl: "https://catalogue.example",
      defaultSelection: { screenId: screen.id },
    }),
  );
});
