import assert from "node:assert/strict";
import test from "node:test";

import type { ShellCatalogueReadModel } from "../packages/viewer/dist/catalogue/scoped_types.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { routeFromUrl } from "../packages/viewer/dist/shell/routes.js";
import { eligibleShellAnchor } from "../packages/viewer/dist/shell/store_browser_routes.js";

import {
  catalogueModel,
  fixtureShellState,
} from "./helpers/viewer_catalogue.js";

test("shell route resolution accepts catalogue routes and rejects other paths", () => {
  const catalogue = createCatalogue(catalogueModel());
  for (const path of [
    "/",
    "/view/product/browse/home/",
    "/view/product/browse/home",
  ])
    assert.notEqual(
      routeFromUrl(catalogue, new URL(path, "https://example.test")).view.kind,
      "missing",
      path,
    );
  for (const path of [
    "/static/mokly-generated/product/browse/home/index.html",
    "/review",
    "/id/home",
    "/id/home/index.html",
    "/id/missing",
  ])
    assert.equal(
      routeFromUrl(catalogue, new URL(path, "https://example.test")).view.kind,
      "missing",
      path,
    );
});

interface ShellLinkCase {
  readonly download?: boolean;
  readonly eligible: boolean;
  readonly event?: Partial<Parameters<typeof eligibleShellAnchor>[0]>;
  readonly href: string;
  readonly name: string;
  readonly target?: string;
}

test("shell link interception leaves native and external activations alone", () => {
  const location = shellLocation();
  const cases: readonly ShellLinkCase[] = [
    {
      name: "catalogue view",
      href: "/view/product/browse/details/",
      eligible: true,
    },
    { name: "catalogue home", href: "/", eligible: true },
    { name: "catalogue id", href: "/id/details", eligible: false },
    {
      name: "explicit self target",
      href: "/view/product/browse/details/",
      target: "_self",
      eligible: true,
    },
    {
      name: "default-prevented activation",
      href: "/view/product/browse/details/",
      event: { defaultPrevented: true },
      eligible: false,
    },
    {
      name: "middle click",
      href: "/view/product/browse/details/",
      event: { button: 1 },
      eligible: false,
    },
    {
      name: "Meta activation",
      href: "/view/product/browse/details/",
      event: { metaKey: true },
      eligible: false,
    },
    {
      name: "Control activation",
      href: "/view/product/browse/details/",
      event: { ctrlKey: true },
      eligible: false,
    },
    {
      name: "Shift activation",
      href: "/view/product/browse/details/",
      event: { shiftKey: true },
      eligible: false,
    },
    {
      name: "Alt activation",
      href: "/view/product/browse/details/",
      event: { altKey: true },
      eligible: false,
    },
    {
      name: "download",
      href: "/view/product/browse/details/",
      download: true,
      eligible: false,
    },
    {
      name: "new context",
      href: "/view/product/browse/details/",
      target: "_blank",
      eligible: false,
    },
    {
      name: "named context",
      href: "/view/product/browse/details/",
      target: "review",
      eligible: false,
    },
    {
      name: "external origin",
      href: "https://elsewhere.test/view/product/browse/details/",
      eligible: false,
    },
    {
      name: "same-document fragment",
      href: "#section",
      eligible: false,
    },
    { name: "static asset", href: "/static/screen.html", eligible: false },
    { name: "removed route", href: "/review", eligible: false },
  ];

  for (const candidate of cases)
    assert.equal(
      eligibleShellAnchor(
        shellEvent(candidate.event),
        shellAnchor(candidate.href, candidate.download, candidate.target),
        location,
      ),
      candidate.eligible,
      candidate.name,
    );
});

test("a stored dark preference applies only when the catalogue supplies dark views", () => {
  assert.equal(
    fixtureShellState({
      initial: { colorScheme: "dark" },
      model: darkCatalogue(),
    }).selection.colorScheme,
    "dark",
  );
  assert.equal(
    fixtureShellState({ initial: { colorScheme: "dark" } }).selection
      .colorScheme,
    "light",
  );
});

test("stored disclosures match current keys and ignore earlier forms of their paths", () => {
  const stored = {
    "/product": true,
    "collection:product": true,
    "folder:pages:product": true,
    "folder:specs:product": false,
    "/components": false,
    "collection:components:components": false,
    "folder:pages:components": false,
  };
  const state = fixtureShellState({
    href: "https://example.test/",
    initial: { disclosures: stored },
  });
  assert.equal(state.disclosures["folder:specs:product"], false);
  assert.equal(state.disclosures["folder:components:components"], true);
  for (const key of ["/product", "folder:pages:product", "/components"])
    assert.equal(Object.hasOwn(state.disclosures, key), false, key);
});

function darkCatalogue(): ShellCatalogueReadModel {
  const model = catalogueModel();
  const screen = model.screens[0]!;
  return {
    ...model,
    screens: model.screens.map((entry) =>
      entry.path === screen.path
        ? {
            ...entry,
            colorSchemes: ["light", "dark"],
            views: entry.views.flatMap((view) => [
              view,
              { ...view, colorScheme: "dark" as const },
            ]),
          }
        : entry,
    ),
  };
}

function shellEvent(
  overrides: Partial<Parameters<typeof eligibleShellAnchor>[0]> = {},
): Parameters<typeof eligibleShellAnchor>[0] {
  return {
    altKey: false,
    button: 0,
    ctrlKey: false,
    defaultPrevented: false,
    metaKey: false,
    shiftKey: false,
    ...overrides,
  } as Parameters<typeof eligibleShellAnchor>[0];
}

function shellAnchor(
  href: string,
  download = false,
  target = "",
): HTMLAnchorElement {
  return {
    href: new URL(href, shellLocation().href).href,
    target,
    hasAttribute(name: string) {
      return name === "download" && download;
    },
  } as HTMLAnchorElement;
}

function shellLocation(): Location {
  return {
    href: "https://example.test/view/welcome/?mode=default",
    origin: "https://example.test",
  } as Location;
}
