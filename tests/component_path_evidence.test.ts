import assert from "node:assert/strict";
import { test } from "node:test";

import {
  pathCatalogueSource,
  pathEvidenceFixture,
  withEntryPaths,
} from "./helpers/component_path_evidence_fixture.js";

const TOKEN = "src/tokens/theme.ts";

test("a glob-only source path is evidence for screens and components without changing their flow", async (t) => {
  const { result } = await pathEvidenceFixture(t, {
    beforeSource: pathCatalogueSource(),
    changedPaths: [TOKEN],
    sharedGlobs: ["src/tokens/**"],
  });

  assert.deepEqual(result.changes, []);
  assert.deepEqual(result.affectedConsumers, []);
  for (const entry of [...result.screens, ...result.components])
    assert.deepEqual(entry.sharedImpact, [TOKEN]);
});

for (const side of ["before", "after"] as const)
  test(`a changed descendant of a ${side}-side declared directory stays evidence only`, async (t) => {
    const withDirectory = pathCatalogueSource(["src/shared"]);
    const withoutDirectory = pathCatalogueSource();
    const changed = "src/shared/registration.tsx";
    const { result } = await pathEvidenceFixture(t, {
      beforeSource: side === "before" ? withDirectory : withoutDirectory,
      afterSource: side === "after" ? withDirectory : withoutDirectory,
      changedPaths: [changed],
      sharedGlobs: [],
    });

    assert.deepEqual(result.changes, []);
    assert.deepEqual(result.affectedConsumers, []);
    for (const entry of [...result.screens, ...result.components])
      assert.deepEqual(entry.sharedImpact, [changed]);
  });

test("exact unowned component and screen declarations keep only their own reasons", async (t) => {
  const actionPath = "src/shared/action.ts";
  const homePath = "src/shared/home.ts";
  const source = withEntryPaths(
    withEntryPaths(pathCatalogueSource(), "action", [actionPath]),
    "home",
    [homePath],
  );
  const { result } = await pathEvidenceFixture(t, {
    beforeSource: source,
    changedPaths: [actionPath, homePath, TOKEN],
    sharedGlobs: ["src/tokens/**"],
  });

  assert.deepEqual(changedRoutes(result), [
    "components/action.html",
    "screens/home.html",
    "user-flows/journey.html",
  ]);
  assert.deepEqual(dependencyPaths(result, "components/action.html"), [
    actionPath,
  ]);
  assert.deepEqual(dependencyPaths(result, "screens/home.html"), [homePath]);
  assert.deepEqual(dependencyPaths(result, "user-flows/journey.html"), []);
  assert.ok(
    result.affectedConsumers.some(
      (item) =>
        item.changedComponentId === "action" &&
        item.consumer.kind === "screen" &&
        item.consumer.route === "screens/home.html",
    ),
  );
});

for (const [name, ownerRoot, changed] of [
  ["file", "notes.md", "notes.md"],
  ["directory", "src/components/action", "src/components/action/impl.ts"],
] as const)
  test(`a component-owned ${name} changes its owner and affects, rather than changes, consumers`, async (t) => {
    const source = withEntryPaths(
      pathCatalogueSource(),
      "action",
      [ownerRoot],
      [ownerRoot],
    );
    const { result } = await pathEvidenceFixture(t, {
      beforeSource: source,
      changedPaths: [changed, TOKEN],
      sharedGlobs: ["src/tokens/**"],
    });

    assert.deepEqual(changedRoutes(result), ["components/action.html"]);
    assert.deepEqual(dependencyPaths(result, "components/action.html"), [
      changed,
    ]);
    assert.deepEqual(
      result.screens.find((entry) => entry.id === "home")?.sharedImpact,
      [TOKEN],
    );
    assert.ok(
      result.affectedConsumers.some(
        (item) =>
          item.changedComponentId === "action" &&
          item.consumer.kind === "screen" &&
          item.consumer.route === "screens/home.html",
      ),
    );
  });

test("an exact screen declaration stays independent even when a component owns the file", async (t) => {
  const source = withEntryPaths(
    withEntryPaths(pathCatalogueSource(), "action", ["notes.md"], ["notes.md"]),
    "home",
    ["notes.md"],
  );
  const { result } = await pathEvidenceFixture(t, {
    beforeSource: source,
    changedPaths: ["notes.md", TOKEN],
    sharedGlobs: ["src/tokens/**"],
  });

  assert.deepEqual(changedRoutes(result), [
    "components/action.html",
    "screens/home.html",
    "user-flows/journey.html",
  ]);
  assert.deepEqual(dependencyPaths(result, "screens/home.html"), ["notes.md"]);
});

test("an unowned registration module under a broad component glob lists nothing", async (t) => {
  const changed = "src/components/action.mokly.tsx";
  const { result } = await pathEvidenceFixture(t, {
    beforeSource: pathCatalogueSource(),
    changedPaths: [changed],
    sharedGlobs: ["src/components/**"],
  });

  assert.deepEqual(result.changes, []);
  assert.deepEqual(result.affectedConsumers, []);
  for (const entry of [...result.screens, ...result.components])
    assert.deepEqual(entry.sharedImpact, [changed]);
});

function changedRoutes(
  result: Awaited<ReturnType<typeof pathEvidenceFixture>>["result"],
): string[] {
  return result.changes.map((entry) => (entry.after ?? entry.before)!.route);
}

function dependencyPaths(
  result: Awaited<ReturnType<typeof pathEvidenceFixture>>["result"],
  route: string,
): string[] {
  return (
    result.changes
      .find((entry) => (entry.after ?? entry.before)?.route === route)
      ?.reasons.flatMap((reason) =>
        reason.kind === "dependency" ? [reason.path] : [],
      ) ?? []
  );
}
