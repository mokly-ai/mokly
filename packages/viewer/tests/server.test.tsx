import assert from "node:assert/strict";
import { test } from "node:test";

import { catalogueComponentVariants } from "../src/catalogue/entry_selection.js";
import { renderViewer } from "../src/viewer/server.js";
import { catalogueUrl, readObjectSource } from "../src/viewer/source.js";

import { fixture, htmlIds, htmlReferences } from "./server_fixture.js";

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

for (const screenPath of [
  null,
  ...fixture.screens.map((entry) => entry.path),
  ...fixture.components.map((entry) => entry.path),
  "unknown-item",
])
  test(`SSR renders ${screenPath ?? "product/browse/home"} from catalogue data`, () => {
    const html = renderViewer({
      viewerId: "fixture",
      catalogue: fixture,
      baseUrl: "https://catalogue.example",
      defaultSelection: { screenPath },
    });
    assert.match(html, /data-mokly-shell/);
    if (screenPath === "unknown-item") assert.match(html, /Item not found/);
    else if (screenPath)
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
      screenPath: fixture.screens[0]!.path,
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
      defaultSelection: { screenPath: fixture.components[0]!.path },
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
  if ("variantOf" in component) throw new Error("Missing component parent");
  const variant = catalogueComponentVariants(model, component.path)[0]!;
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
        defaultSelection: { screenPath: component.path },
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
    defaultSelection: { screenPath: null },
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
