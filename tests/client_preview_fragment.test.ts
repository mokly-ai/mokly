import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { routeFromUrl } from "../packages/viewer/dist/shell/routes.js";
import { TargetStage } from "../packages/viewer/dist/shell/stages.js";
import { viewerCatalogue } from "../packages/viewer/dist/viewer/projection.js";

import { catalogueModel } from "./helpers/viewer_catalogue.js";

const FRAGMENT = "section:one";
const ENCODED_FRAGMENT = "section%3Aone";

test("preview fragment routes update every applicable frame source", () => {
  const model = catalogueModel();
  const screen = model.screens[0]!;
  const mobile = screen.views.find((view) => view.viewport === "mobile")!;
  model.screens = [
    {
      ...screen,
      colorSchemes: ["light", "dark"],
      views: [
        ...screen.views,
        {
          ...mobile,
          colorScheme: "dark",
          fragmentPath: "static/screens/home.mobile.dark.html",
        },
      ],
    },
  ];
  const markup = renderRoute(
    `https://example.test/view/screens/home.html?fragment=${ENCODED_FRAGMENT}`,
    FRAGMENT,
    model,
  );

  const expected = [
    `/static/screens/home.mobile.html#${ENCODED_FRAGMENT}`,
    `/static/screens/home.desktop.html#${ENCODED_FRAGMENT}`,
  ];
  assert.deepEqual(attributeValues(markup, "src"), expected);
  assert.deepEqual(attributeValues(markup, "data-fragment-light"), expected);
  assert.deepEqual(attributeValues(markup, "data-fragment-dark"), [
    `/static/screens/home.mobile.dark.html#${ENCODED_FRAGMENT}`,
  ]);
});

test("only the first flow step receives a preview fragment", () => {
  const model = catalogueModel();
  const flow = model.useCases[0]!;
  model.useCases = [
    {
      ...flow,
      steps: [
        ...flow.steps,
        { screenId: model.screens[0]!.id, title: "Return home" },
      ],
    },
  ];

  const markup = renderRoute(
    `https://example.test/view/user-flows/tour.html?fragment=${ENCODED_FRAGMENT}`,
    FRAGMENT,
    model,
  );
  const sources = attributeValues(markup, "src");
  assert.deepEqual(sources, [
    `/static/screens/home.desktop.html#${ENCODED_FRAGMENT}`,
    "/static/screens/home.desktop.html",
  ]);
  assert.equal(sources.filter((source) => source.includes("#")).length, 1);
});

test("preview fragment routes fail closed before stage rendering", () => {
  for (const search of [
    "",
    "?fragment=one&fragment=two",
    "?fragment=%23section",
    "?fragment=%2523section",
    "?fragment=1section",
    "?fragment=section+one",
  ]) {
    const url = new URL(`https://example.test/view/screens/home.html${search}`);
    const catalogue = viewerCatalogue(catalogueModel());
    const route = routeFromUrl(catalogue, url);
    assert.equal(route.fragment, undefined, search);
    assert.doesNotMatch(renderTarget(catalogue, route), /#[^"]+/, search);
  }
});

test("a valid absent anchor retains its encoded hash without a DOM lookup", () => {
  const markup = renderRoute(
    "https://example.test/view/screens/home.html?fragment=absent",
    "absent",
  );
  assert.deepEqual(attributeValues(markup, "src"), [
    "/static/screens/home.mobile.html#absent",
    "/static/screens/home.desktop.html#absent",
  ]);
});

function renderRoute(
  href: string,
  expectedFragment: string,
  model = catalogueModel(),
): string {
  const catalogue = viewerCatalogue(model);
  const route = routeFromUrl(catalogue, new URL(href));
  assert.equal(route.fragment, expectedFragment);
  return renderTarget(catalogue, route);
}

function renderTarget(
  catalogue: ReturnType<typeof viewerCatalogue>,
  route: ReturnType<typeof routeFromUrl>,
): string {
  assert.equal(route.view.kind, "target");
  if (route.view.kind !== "target") throw new Error("Expected target route.");
  return renderToStaticMarkup(
    createElement(TargetStage, {
      catalogue,
      target: route.view.target,
      ...(route.fragment ? { fragment: route.fragment } : {}),
    }),
  );
}

function attributeValues(markup: string, name: string): readonly string[] {
  return [...markup.matchAll(new RegExp(`${name}="([^"]+)"`, "g"))].map(
    (match) => match[1]!,
  );
}
