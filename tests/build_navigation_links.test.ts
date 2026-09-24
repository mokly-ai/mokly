import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";

test("logical hrefs mark every supported native link owner", async (context) => {
  const fixture = await createFixture(
    validEntrySource({
      body: `<>
        <a href="mock:details">Anchor</a>
        <map name="destinations"><area href="mock:details" shape="default" /></map>
        <svg><a href="mock:details"><text>SVG anchor</text></a></svg>
        <span data-nav-href="mock:details">Metadata</span>
        <a data-nav-href="mock:details" href="mock:details">Dual</a>
      </>`,
    }),
  );
  context.after(() => removeFixture(fixture));

  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const mobile = compilation.outputs.get("screens/home.mobile.html") ?? "";

  assert.equal((mobile.match(/data-mokly-link="details"/g) ?? []).length, 4);
  assert.match(
    mobile,
    /<span data-nav-href="\.\/details\.mobile\.html">Metadata<\/span>/,
  );
  assert.doesNotMatch(mobile, /<span[^>]+data-mokly-link="details"/);
  assert.match(
    mobile,
    /data-nav-href="\.\/details\.mobile\.html" href="\.\/details\.mobile\.html"[^>]+data-mokly-link="details"/,
  );
});

test("logical href rejects resource and non-link owners", async () => {
  for (const body of [
    `<div href="mock:details">Div</div>`,
    `<link href="mock:details" rel="stylesheet" />`,
    `<svg><use href="mock:details" /></svg>`,
    `<svg><image href="mock:details" /></svg>`,
  ]) {
    const fixture = await createFixture(validEntrySource({ body }));
    try {
      await assert.rejects(
        async () => compileCatalogue(await loadConfig(fixture.root)),
        /logical href.*native HTML or SVG link/,
      );
    } finally {
      await removeFixture(fixture);
    }
  }
});

test("metadata-only logical references stay marker-free on any owner", async (context) => {
  const fixture = await createFixture(
    validEntrySource({
      body: `<>
        <div data-nav-href="mock:details">Div</div>
        <link data-nav-href="mock:details" />
        <svg><use data-nav-href="mock:details" /></svg>
        <svg><image data-nav-href="mock:details" /></svg>
      </>`,
    }),
  );
  context.after(() => removeFixture(fixture));

  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const mobile = compilation.outputs.get("screens/home.mobile.html") ?? "";

  assert.equal(
    (mobile.match(/data-nav-href="\.\/details\.mobile\.html"/g) ?? []).length,
    4,
  );
  assert.doesNotMatch(mobile, /data-mokly-link/);
});

test("activatable links reject base URLs but retain base targets", async (context) => {
  const fixture = await createFixture(
    validEntrySource({
      body: `<><base href="https://example.test/" /><a href="mock:details">Details</a></>`,
    }),
  );
  context.after(() => removeFixture(fixture));

  await assert.rejects(
    async () => compileCatalogue(await loadConfig(fixture.root)),
    /base href.*activatable logical link/,
  );

  await fs.promises.writeFile(
    fixture.entryPath,
    validEntrySource({
      body: `<><base target="catalogue" /><a href="mock:details">Details</a></>`,
    }),
  );
  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const mobile = compilation.outputs.get("screens/home.mobile.html") ?? "";
  assert.match(mobile, /<base target="catalogue"/);
  assert.match(mobile, /data-mokly-link="details"/);

  await fs.promises.writeFile(
    fixture.entryPath,
    validEntrySource({
      body: `<><base href="https://example.test/" /><span data-nav-href="mock:details">Details</span></>`,
    }),
  );
  await compileCatalogue(await loadConfig(fixture.root));
});

test("logical fragments require one anchor across every target view", async (context) => {
  const fixture = await createFixture(fragmentSource("section", "section"), {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  context.after(() => removeFixture(fixture));

  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  for (const route of [
    "screens/home.mobile.html",
    "screens/home.desktop.html",
    "screens/home.mobile.dark.html",
    "screens/home.desktop.dark.html",
  ]) {
    const output = compilation.outputs.get(route) ?? "";
    assert.match(output, /data-mokly-link="details#section"/);
    assert.match(output, /href="\.\/details\.[^"]+\.html#section"/);
  }

  await fs.promises.writeFile(
    fixture.entryPath,
    fragmentSource("mobile-section", "section"),
  );
  await assert.rejects(
    async () => compileCatalogue(await loadConfig(fixture.root)),
    /logical fragment section.*missing.*mobile/,
  );
});

test("logical link syntax and reserved metadata fail closed", async () => {
  for (const body of [
    `<a href="mock:details#1section">Details</a>`,
    `<a href="mock:details#section%20name">Details</a>`,
    `<a data-mokly-link="details" href="mock:details">Details</a>`,
    `<a data-nav-href="mock:home" href="mock:details">Conflict</a>`,
  ]) {
    const fixture = await createFixture(validEntrySource({ body }));
    try {
      await assert.rejects(
        async () => compileCatalogue(await loadConfig(fixture.root)),
        /malformed logical link|reserved data-mokly-link|conflicting logical destinations/,
      );
    } finally {
      await removeFixture(fixture);
    }
  }
});

test("logical destinations include use cases and reject non-routed ids", async (context) => {
  const fixture = await createFixture(useCaseFragmentSource(), {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  context.after(() => removeFixture(fixture));

  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const light = compilation.outputs.get("screens/home.mobile.html") ?? "";
  const dark = compilation.outputs.get("screens/home.desktop.dark.html") ?? "";
  assert.match(light, /href="\.\/details\.mobile\.html#section"/);
  assert.match(light, /data-mokly-link="tour#section"/);
  assert.match(dark, /href="\.\/details\.desktop\.html#section"/);
  assert.match(dark, /data-mokly-link="tour#section"/);

  for (const destination of ["missing", "fixture"]) {
    await fs.promises.writeFile(
      fixture.entryPath,
      validEntrySource({ body: `<a href="mock:${destination}">Open</a>` }),
    );
    await assert.rejects(
      async () => compileCatalogue(await loadConfig(fixture.root)),
      new RegExp(`unknown id: ${destination}`),
    );
  }
});

function fragmentSource(mobileAnchor: string, desktopAnchor: string): string {
  return `import { defineScreen } from "@mokly/mokly";
import React from "react";
const metadata = { dependencies: [], navPath: ["Fixture"], relatedDocs: [], useCaseIds: [] };
export const mockups = [
  defineScreen({ ...metadata, description: "Home", desktop: <main><a href="mock:details#section">Details</a></main>, id: "home", mobile: <main><a href="mock:details#section">Details</a></main>, route: "screens/home.html", title: "Home" }),
  defineScreen({ ...metadata, description: "Details", desktop: <main id=${JSON.stringify(desktopAnchor)}>Details</main>, id: "details", mobile: <main id=${JSON.stringify(mobileAnchor)}>Details</main>, route: "screens/details.html", title: "Details" })
];
`;
}

function useCaseFragmentSource(): string {
  return `import { defineScreen, defineUseCase } from "@mokly/mokly";
import React from "react";
const metadata = { dependencies: [], navPath: ["Fixture"], relatedDocs: [] };
export const mockups = [
  defineScreen({ ...metadata, description: "Home", desktop: <main><a href="mock:tour#section">Tour</a></main>, id: "home", mobile: <main><a href="mock:tour#section">Tour</a></main>, route: "screens/home.html", title: "Home", useCaseIds: [] }),
  defineScreen({ ...metadata, colorSchemes: ["light"], description: "Details", desktop: <main id="section">Details</main>, id: "details", mobile: <main id="section">Details</main>, route: "screens/details.html", title: "Details", useCaseIds: ["tour"] }),
  defineUseCase({ ...metadata, description: "Tour", id: "tour", route: "user-flows/tour.html", steps: [{ screenId: "details" }], title: "Tour" })
];
`;
}
