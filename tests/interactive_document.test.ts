import assert from "node:assert/strict";
import test from "node:test";

import type { ManifestEntry } from "@mokly/viewer/data";

import {
  buildInteractiveBootstrap,
  composeInteractiveDocument,
  serializeInteractiveBootstrap,
} from "../dist/interactive/document.js";
import { InteractiveDocumentError } from "../dist/interactive/errors.js";
import { buildInteractiveRouteTable } from "../dist/interactive/route_table.js";
import {
  configureInteractiveRoutes,
  resolveInteractiveLink,
} from "../dist/interactive/runtime/route_context.js";
import type { InteractiveBootstrap } from "../dist/interactive/types.js";

const entries = [screen("home"), screen("details")];
const metadata = {
  links: [
    {
      fragment: "section",
      id: "details",
      target: { kind: "top" as const },
    },
  ],
  ranges: [],
};
const adapted = [
  '<!doctype html><html><head><meta charset="utf-8">',
  `<template data-mokly-inspector>${JSON.stringify(metadata)}</template>`,
  '<script src="/__mokly/client/inspector.js" defer></script></head>',
  '<body data-mokly-viewport="mobile"><main><!--mokly-range-->',
  "<p>Static first paint</p></main></body></html>\n",
].join("");

test("route table reuses artifact routes without inspector indirection", () => {
  const result = buildInteractiveRouteTable({
    catalogueSchemes: ["light"],
    colorScheme: "light",
    entries,
    sourceRoute: "screens/home.mobile.html",
    viewport: "mobile",
  });

  assert.deepEqual(result.details, {
    href: "./details.mobile.html",
  });
});

test("route tables support more than the inspector metadata link limit", () => {
  const large = Array.from({ length: 1_201 }, (_, index) =>
    screen(`screen-${index}`),
  );
  const routes = buildInteractiveRouteTable({
    catalogueSchemes: ["light"],
    colorScheme: "light",
    entries: large,
    sourceRoute: "screens/screen-0.mobile.html",
    viewport: "mobile",
  });

  assert.equal(Object.keys(routes).length, 1_201);
  assert.equal(routes["screen-1200"]?.href, "./screen-1200.mobile.html");
});

test("browser route lookup treats prototype names as absent", () => {
  configureInteractiveRoutes({});
  assert.equal(resolveInteractiveLink("mock:constructor"), undefined);
});

test("browser route lookup builds a validated logical identity", () => {
  configureInteractiveRoutes({ details: { href: "./details.mobile.html" } });

  assert.deepEqual(resolveInteractiveLink("mock:details#section", "_top"), {
    href: "./details.mobile.html#section",
    identity: {
      fragment: "section",
      id: "details",
      target: { kind: "top" },
    },
  });
});

test("Live composition changes only head bytes and emits one script of each kind", () => {
  const built = buildInteractiveBootstrap({
    catalogueSchemes: ["light"],
    colorScheme: "light",
    entries,
    entryId: "home",
    generation: "generation_1",
    sourceRoute: "screens/home.mobile.html",
    viewport: "mobile",
  });
  const live = composeInteractiveDocument(adapted, built);
  const bodyOffset = adapted.indexOf("<body");
  const bootstrap = `<script type="application/json" data-mokly-interactive>${serializeInteractiveBootstrap(built.bootstrap)}</script>`;
  const inspector =
    '<script src="/__mokly/client/inspector.js" defer></script>';
  const moduleScript =
    '<script type="module" src="/__mokly/interactive/generation_1/bundle.js"></script>';

  assert.equal(live.slice(live.indexOf("<body")), adapted.slice(bodyOffset));
  assert.equal(
    live,
    adapted.replace(inspector, bootstrap + inspector + moduleScript),
  );
  assert.equal(live.match(/data-mokly-interactive/g)?.length, 1);
  assert.equal(live.match(/\/__mokly\/client\/inspector\.js/g)?.length, 1);
  assert.equal(
    live.match(/\/__mokly\/interactive\/generation_1\/bundle\.js/g)?.length,
    1,
  );
  assert.deepEqual(Object.keys(built.bootstrap).sort(), [
    "colorScheme",
    "entryId",
    "entryKind",
    "generation",
    "routes",
    "viewport",
  ]);
  assert.doesNotMatch(
    live.slice(0, live.indexOf("<body")),
    /sourcePath|sourceRelativePath|componentProps/,
  );
});

test("bootstrap JSON is canonical and cannot terminate its script", () => {
  const bootstrap = {
    colorScheme: "light",
    entryId: "home",
    entryKind: "screen",
    generation: "generation",
    routes: {
      home: {
        href: "./home.html</script>&",
      },
    },
    viewport: "mobile",
  } as InteractiveBootstrap;
  const serialized = serializeInteractiveBootstrap(bootstrap);

  assert.doesNotMatch(serialized, /[<>&]/);
  assert.match(serialized, /\\u003c\/script\\u003e\\u0026/);
  assert.equal(serialized, serializeInteractiveBootstrap(bootstrap));
});

test("invalid generations are document failures rather than bundle failures", () => {
  assert.throws(
    () =>
      buildInteractiveBootstrap({
        catalogueSchemes: ["light"],
        colorScheme: "light",
        entries,
        entryId: "home",
        generation: "not valid",
        sourceRoute: "screens/home.mobile.html",
        viewport: "mobile",
      }),
    documentFailure,
  );
});

test("missing and misplaced inspector metadata are document failures", () => {
  const bodyMetadata = [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<script src="/__mokly/client/inspector.js" defer></script>',
    "</head><body>",
    `<template data-mokly-inspector>${JSON.stringify(metadata)}</template>`,
    "</body></html>",
  ].join("");

  const built = buildInteractiveBootstrap({
    catalogueSchemes: ["light"],
    colorScheme: "light",
    entries,
    entryId: "home",
    generation: "generation",
    sourceRoute: "screens/home.mobile.html",
    viewport: "mobile",
  });
  for (const document of [
    bodyMetadata,
    adapted.replace(/<template data-mokly-inspector>.*?<\/template>/, ""),
  ])
    assert.throws(
      () => composeInteractiveDocument(document, built),
      documentFailure,
    );
});

function documentFailure(error: unknown): boolean {
  assert.ok(error instanceof InteractiveDocumentError);
  assert.notEqual(
    (error as InteractiveDocumentError & { code?: string }).code,
    "interactive-bundle",
  );
  return true;
}

function screen(id: string): Extract<ManifestEntry, { kind: "screen" }> {
  const sourceRelativePath = "entries/interactive.mockup.tsx";
  return {
    declaredDependencies: [],
    dependencies: [],
    description: id,
    fragments: {
      desktop: `screens/${id}.desktop.html`,
      mobile: `screens/${id}.mobile.html`,
    },
    id,
    kind: "screen",
    navPath: [],
    relatedDocs: [],
    route: `screens/${id}.html`,
    sourcePath: sourceRelativePath,
    title: id,
    useCaseIds: [],
    viewports: ["mobile", "desktop"],
  };
}
