import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  EVERY_FRAME,
  workspaceFrames,
} from "../packages/viewer/dist/shell/canvas_frames.js";
import { openingUseCaseChoice } from "../packages/viewer/dist/shell/canvas_use_case_frames.js";
import type { WorkspaceCanvas } from "../packages/viewer/dist/shell/canvas_workspace.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { DisplaySelection } from "../packages/viewer/dist/shell/display_context.js";
import { publicWorkspace } from "../packages/viewer/dist/shell/public_workspace.js";
import { routeFromUrl } from "../packages/viewer/dist/shell/routes.js";
import { defaultSelection } from "../packages/viewer/dist/shell/selection.js";
import { TargetStage } from "../packages/viewer/dist/shell/stages.js";

import { catalogueModel, inShellStore } from "./helpers/viewer_catalogue.js";

const FRAGMENT = "section:one";
const ENCODED_FRAGMENT = "section%3Aone";

test("preview fragment routes update every applicable frame source", () => {
  const model = catalogueModel();
  const screen = model.screens.find(
    (entry) => entry.path === "product/browse/home",
  )!;
  const mobile = screen.views.find((view) => view.viewport === "mobile")!;
  model.screens = model.screens.map((entry) =>
    entry.path !== screen.path
      ? entry
      : {
          ...screen,
          colorSchemes: ["light", "dark"],
          views: [
            ...screen.views,
            {
              ...mobile,
              colorScheme: "dark",
            },
          ],
        },
  );
  const markup = renderRoute(
    `https://example.test/view/product/browse/home/?fragment=${ENCODED_FRAGMENT}`,
    FRAGMENT,
    model,
  );

  // Each frame of the canvas opens at the fragment: the Light row's Desktop
  // and Mobile frames, and the Dark row's Mobile frame, the screen's one dark
  // view. Each frame shows its own scheme, so a scheme choice keeps every
  // frame's document and fragment.
  const expected = [
    `/static/mokly-generated/product/browse/home/index.desktop.html#${ENCODED_FRAGMENT}`,
    `/static/mokly-generated/product/browse/home/index.mobile.html#${ENCODED_FRAGMENT}`,
    `/static/mokly-generated/product/browse/home/index.mobile.dark.html#${ENCODED_FRAGMENT}`,
  ];
  assert.deepEqual(attributeValues(markup, "src"), expected);
  for (const colorScheme of ["light", "dark"] as const)
    assert.deepEqual(
      attributeValues(
        renderRoute(
          `https://example.test/view/product/browse/home/?fragment=${ENCODED_FRAGMENT}`,
          FRAGMENT,
          model,
          colorScheme,
        ),
        "src",
      ),
      expected,
      colorScheme,
    );
});

test("only the first flow step receives a preview fragment", () => {
  const model = catalogueModel();
  const flow = model.useCases[0]!;
  model.useCases = [
    {
      ...flow,
      steps: [
        ...flow.steps,
        { screenPath: "product/browse/home", title: "Return home" },
      ],
    },
  ];

  const markup = renderRoute(
    `https://example.test/view/tour/?fragment=${ENCODED_FRAGMENT}`,
    FRAGMENT,
    model,
  );
  const sources = attributeValues(markup, "src");
  assert.deepEqual(sources, [
    `/static/mokly-generated/product/browse/home/index.desktop.html#${ENCODED_FRAGMENT}`,
    "/static/mokly-generated/product/browse/details/index.desktop.html",
    "/static/mokly-generated/product/browse/home/index.desktop.html",
  ]);
  assert.equal(sources.filter((source) => source.includes("#")).length, 1);
});

test("preview fragment routes fail closed before stage rendering", () => {
  for (const search of [
    "",
    "?fragment=one&fragment=two",
    "?fragment=%23section",
    "?fragment=%2523section",
    "?fragment=section%2Fone",
    "?fragment=section+one",
  ]) {
    const url = new URL(
      `https://example.test/view/product/browse/home/${search}`,
    );
    const catalogue = createCatalogue(catalogueModel());
    const route = routeFromUrl(catalogue, url);
    assert.equal(route.fragment, undefined, search);
    assert.doesNotMatch(renderTarget(catalogue, route), /#[^"]+/, search);
  }
});

test("a valid absent anchor retains its encoded hash without a DOM lookup", () => {
  const markup = renderRoute(
    "https://example.test/view/product/browse/home/?fragment=absent",
    "absent",
  );
  assert.deepEqual(attributeValues(markup, "src"), [
    "/static/mokly-generated/product/browse/home/index.desktop.html#absent",
    "/static/mokly-generated/product/browse/home/index.mobile.html#absent",
  ]);
});

function renderRoute(
  href: string,
  expectedFragment: string,
  model = catalogueModel(),
  colorScheme: "dark" | "light" = "light",
): string {
  const catalogue = createCatalogue(model);
  const route = routeFromUrl(catalogue, new URL(href));
  assert.equal(route.fragment, expectedFragment);
  return renderTarget(catalogue, route, colorScheme, model);
}

/**
 * The canvas of a routed screen or component, as its workspace gives it at
 * a full page load: every frame of the entry, both viewports in each of its
 * schemes.
 */
function workspaceCanvas(
  catalogue: ReturnType<typeof createCatalogue>,
  model: ReturnType<typeof catalogueModel>,
  route: ReturnType<typeof routeFromUrl>,
): WorkspaceCanvas | undefined {
  if (route.view.kind !== "target") return undefined;
  const entry = route.view.target.entry;
  if (entry.kind !== "screen" && entry.kind !== "component") return undefined;
  const data = publicWorkspace(catalogue, model, entry);
  return { fitKey: entry.path, frames: workspaceFrames(data, EVERY_FRAME) };
}

function renderTarget(
  catalogue: ReturnType<typeof createCatalogue>,
  route: ReturnType<typeof routeFromUrl>,
  colorScheme: "dark" | "light" = "light",
  model = catalogueModel(),
): string {
  assert.equal(route.view.kind, "target");
  if (route.view.kind !== "target") throw new Error("Expected target route.");
  const canvas = workspaceCanvas(catalogue, model, route);
  return renderToStaticMarkup(
    inShellStore(
      createElement(DisplaySelection.Provider, {
        value: { ...defaultSelection, colorScheme },
        children: createElement(TargetStage, {
          catalogue,
          target: route.view.target,
          // A use case opens on its wide canvas's choice.
          useCaseChoice: openingUseCaseChoice(true),
          ...(canvas ? { canvas } : {}),
          ...(route.fragment ? { fragment: route.fragment } : {}),
        }),
      }),
    ),
  );
}

function attributeValues(markup: string, name: string): readonly string[] {
  return [...markup.matchAll(new RegExp(`${name}="([^"]+)"`, "g"))].map(
    (match) => match[1]!,
  );
}
