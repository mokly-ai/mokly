import assert from "node:assert/strict";
import test from "node:test";

import { parseHistoricalManifest } from "../dist/registry/manifest.js";
import { compareReview } from "../dist/review/compare.js";

import { componentGit } from "./helpers/component_review_fixture.js";
import {
  historicalLayoutFixture,
  historicalPaths,
} from "./helpers/historical_layout_fixture.js";

for (const kind of ["screen", "page", "use-case", "component"] as const)
  test(`historical ${kind} routes must retain their identity-derived layout`, async (context) => {
    const fixture = await historicalLayoutFixture(
      context,
      kind === "component",
    );
    fixture.historical.entries.find((entry) => entry.kind === kind)!.route =
      "nested/old-route.html";
    assert.throws(() => parseHistoricalManifest(fixture.historical), {
      code: "baseline-incompatible-earlier",
    });
  });

for (const version of [3, 4, 5, 6])
  test(`historical v${version} nested entry routes produce the typed unavailable outcome`, async (context) => {
    const fixture = await historicalLayoutFixture(context);
    const historical = historicalPaths(fixture.current.manifest, version);
    historical.entries[0]!.route = "legacy/nested/entry.html";
    assert.throws(() => parseHistoricalManifest(historical), {
      code: "baseline-incompatible-earlier",
    });
  });

for (const field of ["fragments", "darkFragments"] as const)
  for (const viewport of ["mobile", "desktop"] as const)
    test(`historical ${field}/${viewport} cannot change the pane origin`, async (context) => {
      const { historical } = await historicalLayoutFixture(context);
      const screen = historical.entries.find(({ kind }) => kind === "screen")!;
      (screen[field] as Record<string, string>)[viewport] =
        `legacy/screens/welcome.${viewport}.html`;
      assert.throws(() => parseHistoricalManifest(historical), {
        code: "baseline-incompatible-earlier",
      });
    });

test("former component variant directories are unavailable before ownership range validation", async (context) => {
  const { historical } = await historicalLayoutFixture(context, true);
  const parent = historical.entries.find(({ kind }) => kind === "component")!;
  const variants = parent.variants as Record<string, unknown>[];
  (variants[0]!.fragments as Record<string, string>).mobile =
    "components/action.variants/default.mobile.html";
  variants[0]!.componentViews = [{ obsolete: true }];
  assert.throws(() => parseHistoricalManifest(historical), {
    code: "baseline-incompatible-earlier",
  });
});

test("a local variant id that matches another entry is checked against its normalized component identity", async (context) => {
  const { historical } = await historicalLayoutFixture(context, true);
  const parent = historical.entries.find((entry) => entry.id === "action")!;
  const variant = (parent.variants as Record<string, unknown>[])[0]!;
  variant.id = "home";
  variant.fragments = {
    mobile: "components/action-home.mobile.html",
    desktop: "components/action-home.desktop.html",
  };
  variant.darkFragments = {
    mobile: "components/action-home.mobile.dark.html",
    desktop: "components/action-home.desktop.dark.html",
  };
  assert.doesNotThrow(() => parseHistoricalManifest(historical));
});

test("identity-layout historical component records normalize and compare without source-path evidence", async (context) => {
  const fixture = await historicalLayoutFixture(context, true);
  assert.deepEqual(
    parseHistoricalManifest(fixture.historical),
    fixture.current.manifest,
  );
  const before = {
    ...fixture.current,
    outputs: new Map([
      ...fixture.current.outputs,
      ["mokly-manifest.json", JSON.stringify(fixture.historical)],
    ]),
  };
  const { result } = await compareReview(
    fixture.current,
    fixture.config,
    componentGit(before, ["unused.ts"]),
    "main",
  );
  assert.deepEqual(result.changes, []);
});

test("unsafe or malformed historical paths do not use the graceful availability branch", async (context) => {
  const { historical } = await historicalLayoutFixture(context);
  for (const path of [
    "../escape.html",
    "/absolute.html",
    "screens/home.html?query",
    "screens\\home.html",
    42,
  ]) {
    const invalid = structuredClone(historical);
    invalid.entries[0]!.route = path;
    assert.throws(() => parseHistoricalManifest(invalid), {
      code: "manifest-invalid",
    });
  }
  for (const fragments of [
    null,
    [],
    {},
    { mobile: "screens/home.mobile.html" },
  ]) {
    const invalid = structuredClone(historical);
    const screen = invalid.entries.find(({ kind }) => kind === "screen")!;
    screen.fragments = fragments;
    assert.throws(() => parseHistoricalManifest(invalid), {
      code: "manifest-invalid",
    });
  }
});

test("older layouts stop comparison before any document or resource is read", async (context) => {
  const fixture = await historicalLayoutFixture(context);
  fixture.historical.entries[0]!.route = "legacy/nested/entry.html";
  const before = {
    ...fixture.current,
    outputs: new Map([
      ["mokly-manifest.json", JSON.stringify(fixture.historical)],
    ]),
  };
  const repository = componentGit(before, []);
  const read = repository.reader.readFile;
  const reads: string[] = [];
  repository.reader.readFile = async (commit, path) => {
    reads.push(path);
    return read(commit, path);
  };
  await assert.rejects(
    compareReview(fixture.current, fixture.config, repository, "main"),
    { code: "baseline-incompatible-earlier" },
  );
  assert.deepEqual(reads, ["mockups/mokly-manifest.json"]);
});
