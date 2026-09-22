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
    viewerId: "fixture",
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
      viewerId: "fixture",
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

test("SSR and hydratable React render agree for selection and all slots", async () => {
  const { renderToString } = await import("react-dom/server");
  const { MoklyViewer } = await import("../src/viewer/component.js");
  const props = {
    viewerId: "fixture",
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
  assert.equal(renderToString(<MoklyViewer {...props} />), html);
  assert.match(html, /data-mokly-color-scheme="dark"/);
  assert.match(html, /data-viewport="mobile"/);
  assert.match(html, /value="phrase tag:forms"/);
});

test("independent SSR viewers keep IDs and references root-local", () => {
  const render = (viewerId: string) =>
    renderViewer({
      viewerId,
      catalogue: fixture,
      baseUrl: "https://catalogue.example",
      defaultSelection: { screenId: fixture.components[0]!.id },
    });
  const first = render("primary");
  const second = render("secondary");
  const firstIds = htmlIds(first);
  const secondIds = htmlIds(second);

  assert.ok(firstIds.size > 0);
  assert.ok([...firstIds].every((id) => id.startsWith("mokly-7-primary-")));
  assert.ok([...secondIds].every((id) => id.startsWith("mokly-9-secondary-")));
  assert.deepEqual(
    [...firstIds].filter((id) => secondIds.has(id)),
    [],
  );
  assert.ok(htmlReferences(first).every((id) => firstIds.has(id)));
  assert.ok(htmlReferences(second).every((id) => secondIds.has(id)));
});

test("distinct valid viewer IDs cannot absorb dynamic control IDs", () => {
  const model = structuredClone(fixture);
  const component = model.components[0]!;
  const variant = component.variants[0]!;
  component.controls = {
    ...component.controls,
    "mb-main": component.controls.label!,
  };
  component.propSchema = {
    ...component.propSchema,
    properties: {
      ...component.propSchema.properties,
      "mb-main": {
        ...component.propSchema.properties.label!,
        optional: true,
      },
    },
  };
  variant.props = {
    ...variant.props,
    "mb-main": variant.props.label!,
  };
  const render = (viewerId: string) =>
    htmlIds(
      renderViewer({
        viewerId,
        catalogue: model,
        baseUrl: "https://catalogue.example",
        defaultSelection: { screenId: component.id },
      }),
    );
  const firstIds = render("x");
  const secondIds = render("x-mb-prop-action");

  assert.deepEqual(
    [...firstIds].filter((id) => secondIds.has(id)),
    [],
  );
});

test("server and React viewer IDs share one validation contract", async () => {
  const { renderToString } = await import("react-dom/server");
  const { MoklyViewer } = await import("../src/viewer/component.js");
  const props = {
    catalogue: fixture,
    baseUrl: "https://catalogue.example",
    defaultSelection: { screenId: null },
  };
  for (const viewerId of ["", "-viewer", "viewer space", "é", "v".repeat(65)]) {
    assert.throws(
      () => renderViewer({ ...props, viewerId }),
      /Invalid viewerId/,
    );
    assert.throws(
      () => renderToString(<MoklyViewer {...props} viewerId={viewerId} />),
      /Invalid viewerId/,
    );
  }
  assert.doesNotThrow(() =>
    renderViewer({ ...props, viewerId: "v".repeat(64) }),
  );
});

test("SSR selects a requested saved variant in its control and preview", () => {
  const model = structuredClone(fixture);
  const component = model.components[0]!;
  const original = component.variants[0]!;
  component.variants = [
    original,
    {
      ...structuredClone(original),
      id: "second",
      title: "Second",
      views: original.views.map((view) => ({
        ...structuredClone(view),
        fragmentPath: view.fragmentPath?.replace("default", "second") ?? null,
      })),
    },
  ];
  const html = renderViewer({
    viewerId: "fixture",
    catalogue: model,
    baseUrl: "https://catalogue.example",
    defaultSelection: { screenId: component.id, variantId: "second" },
  });
  assert.match(html, /<option value="second" selected="">Second<\/option>/);
  assert.match(html, /action\.variants\/second\.(?:mobile|desktop)\.html/);
});

test("SSR resolves light fallback evidence across status, marks and comparison", () => {
  const model = structuredClone(fixture);
  const screen = model.screens.find((entry) => entry.id === "home");
  const component = model.components.find((entry) => entry.id === "action");
  if (!screen || !component) throw new Error("Missing mixed-view fixture");
  screen.changes = { status: "ready", kind: "changed", included: true };
  screen.views = screen.views.map((view) => ({
    ...view,
    comparison: {
      status: "ready",
      kind: view.viewport === "mobile" ? "unmodified" : "changed",
      eligible: view.viewport !== "mobile",
    },
  }));
  component.colorSchemes = ["light", "dark"];
  component.variants = component.variants.map((variant) => ({
    ...variant,
    views: variant.views.flatMap((view) => [
      view,
      {
        ...structuredClone(view),
        colorScheme: "dark" as const,
        fragmentPath: view.fragmentPath?.replace(".html", ".dark.html") ?? null,
      },
    ]),
  }));

  const html = renderViewer({
    viewerId: "mixed",
    catalogue: model,
    baseUrl: "https://catalogue.example",
    defaultSelection: {
      screenId: screen.id,
      viewport: "mobile",
      colorScheme: "dark",
    },
  });

  assert.match(html, /data-workspace-status="">Unmodified</);
  assert.match(html, /class="mbk-diff-toolbar" hidden=""/);
  assert.match(html, /data-view-changed="scheme" hidden=""/);
  assert.doesNotMatch(html, /data-view-changed="viewport" hidden=""/);
});

test("SSR preserves comparison ineligibility while view evidence is unknown", () => {
  const model = structuredClone(fixture);
  const component = model.components.find((entry) => entry.id === "action");
  if (!component) throw new Error("Missing component fixture");
  component.changes = { status: "ready", kind: "changed", included: true };

  const html = renderViewer({
    viewerId: "unknown-evidence",
    catalogue: model,
    baseUrl: "https://catalogue.example",
    defaultSelection: { screenId: component.id },
  });

  assert.match(html, /data-workspace-status="">Changed</);
  assert.match(html, /class="mbk-diff-toolbar" hidden=""/);
});

test("invalid current paths are rejected instead of replaced with guessed URLs", () => {
  const model = structuredClone(fixture);
  const screen = model.screens[0]!;
  for (const view of screen.views) view.fragmentPath = null;
  assert.throws(() =>
    renderViewer({
      viewerId: "fixture",
      catalogue: model,
      baseUrl: "https://catalogue.example",
      defaultSelection: { screenId: screen.id },
    }),
  );
});

function htmlIds(html: string): Set<string> {
  return new Set(
    [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]!),
  );
}

function htmlReferences(html: string): string[] {
  return [
    ...html.matchAll(
      /\s(?:aria-controls|aria-describedby|aria-labelledby|for)="([^"]+)"|\shref="#([^"]+)"/g,
    ),
  ].flatMap((match) => (match[1] ?? match[2]!).split(" "));
}
