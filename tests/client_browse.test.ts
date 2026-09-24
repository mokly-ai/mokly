import assert from "node:assert/strict";
import test from "node:test";

import type { CatalogueReadModel } from "../packages/viewer/dist/catalogue/types.js";
import { routeFromUrl } from "../packages/viewer/dist/shell/routes.js";
import { eligibleShellAnchor } from "../packages/viewer/dist/shell/store_browser_routes.js";
import type { ShellRecoverySnapshot } from "../packages/viewer/dist/shell/store_state.js";
import { viewerCatalogue } from "../packages/viewer/dist/viewer/projection.js";

import {
  catalogueModel,
  fixtureShellState,
} from "./helpers/viewer_catalogue.js";

test("shell route resolution accepts catalogue routes and rejects other paths", () => {
  const catalogue = viewerCatalogue(catalogueModel());
  for (const path of [
    "/",
    "/view/screens/home.html",
    "/id/home",
    "/id/home/index.html",
  ])
    assert.notEqual(
      routeFromUrl(catalogue, new URL(path, "https://example.test")).view.kind,
      "missing",
      path,
    );
  for (const path of ["/static/screens/home.html", "/review", "/id/missing"])
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
      href: "/view/screens/details.html",
      eligible: true,
    },
    { name: "catalogue home", href: "/", eligible: true },
    { name: "catalogue id", href: "/id/details", eligible: true },
    {
      name: "explicit self target",
      href: "/view/screens/details.html",
      target: "_self",
      eligible: true,
    },
    {
      name: "default-prevented activation",
      href: "/view/screens/details.html",
      event: { defaultPrevented: true },
      eligible: false,
    },
    {
      name: "middle click",
      href: "/view/screens/details.html",
      event: { button: 1 },
      eligible: false,
    },
    {
      name: "Meta activation",
      href: "/view/screens/details.html",
      event: { metaKey: true },
      eligible: false,
    },
    {
      name: "Control activation",
      href: "/view/screens/details.html",
      event: { ctrlKey: true },
      eligible: false,
    },
    {
      name: "Shift activation",
      href: "/view/screens/details.html",
      event: { shiftKey: true },
      eligible: false,
    },
    {
      name: "Alt activation",
      href: "/view/screens/details.html",
      event: { altKey: true },
      eligible: false,
    },
    {
      name: "download",
      href: "/view/screens/details.html",
      download: true,
      eligible: false,
    },
    {
      name: "new context",
      href: "/view/screens/details.html",
      target: "_blank",
      eligible: false,
    },
    {
      name: "named context",
      href: "/view/screens/details.html",
      target: "review",
      eligible: false,
    },
    {
      name: "external origin",
      href: "https://elsewhere.test/view/screens/details.html",
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

test("recovery restores dark only when the catalogue supplies dark views", () => {
  assert.equal(
    fixtureShellState({
      initial: { recovery: recovery({ colorScheme: "dark" }) },
      model: darkCatalogue(),
    }).selection.colorScheme,
    "dark",
  );
  assert.equal(
    fixtureShellState({
      initial: { recovery: recovery({ colorScheme: "dark" }) },
    }).selection.colorScheme,
    "light",
  );
});

test("recovery restores viewport, details, drawer, and scroll state", () => {
  const state = fixtureShellState({
    initial: {
      recovery: recovery({
        detailsOpen: true,
        drawerOpen: true,
        navScroll: 12,
        regionScrolls: { stage: 42 },
        viewport: "mobile",
      }),
    },
  });
  assert.equal(state.detailsOpen, true);
  assert.equal(state.drawerOpen, true);
  assert.equal(state.navScroll, 12);
  assert.deepEqual(state.regionScrolls, { stage: 42 });
  assert.equal(state.selection.viewport, "mobile");
});

test("recovery parses its tag query into the selected chips", () => {
  const state = fixtureShellState({
    initial: { recovery: recovery({ query: "tag:forms" }) },
  });
  assert.equal(state.query, "tag:forms");
  assert.equal(state.selection.search, "");
  assert.deepEqual(state.selection.tags, ["forms"]);
});

test("recovery matches stable disclosure keys and ignores label paths", () => {
  const state = fixtureShellState({
    href: "https://example.test/",
    initial: {
      recovery: recovery({
        disclosures: {
          "/Same title": false,
          "collection:Product": false,
          "folder:pages:Product": false,
        },
        filterBaselineDisclosures: {
          "/Same title": false,
          "collection:Product": false,
          "folder:pages:Product": false,
        },
      }),
    },
  });
  assert.equal(state.disclosures["folder:pages:Product"], false);
  assert.equal(state.disclosures["folder:components:Product"], true);
  assert.equal(state.filterBaseline?.["folder:pages:Product"], false);
  assert.equal(Object.hasOwn(state.disclosures, "/Same title"), false);
});

function darkCatalogue(): CatalogueReadModel {
  const model = catalogueModel();
  const screen = model.screens[0]!;
  const darkViews = screen.views.map((view) => ({
    ...view,
    colorScheme: "dark" as const,
    fragmentPath: view.fragmentPath?.replace(".html", ".dark.html") ?? null,
  }));
  return {
    ...model,
    screens: [
      {
        ...screen,
        colorSchemes: ["light", "dark"],
        views: [...screen.views, ...darkViews],
      },
    ],
  };
}

function recovery(
  overrides: Partial<ShellRecoverySnapshot> = {},
): ShellRecoverySnapshot {
  return {
    disclosures: {},
    colorScheme: "light",
    detailsOpen: false,
    drawerOpen: false,
    filterBaselineDisclosures: null,
    navScroll: 0,
    query: "",
    regionScrolls: {},
    view: "all",
    viewport: "both",
    ...overrides,
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
    href: "https://example.test/view/screens/welcome.html?variant=default",
    origin: "https://example.test",
  } as Location;
}
