import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import {
  interactiveServerFixture,
  removeInteractiveFixture,
} from "./helpers/interactive_server.js";

const eligibilityById = new Map([
  ["home", false],
  ["details", true],
  ["action", false],
  ["pane", true],
]);

test("Serve carries route-scoped Live eligibility before and after completion", async (t) => {
  const live = await interactiveServerFixture({ source: eligibilitySource() });
  t.after(() => removeInteractiveFixture(live.fixture));

  await assertEligibility(live.server.url, eligibilityById);
  await assertPublicCatalogueOmitsEligibility(live.server.url);

  const compilation = await compileCatalogue(live.runtime.config);
  assert.equal(
    live.server.completeCatalogue?.(
      compilation.manifest,
      live.runtime.generation,
    ),
    true,
  );

  await assertEligibility(live.server.url, eligibilityById);
  await assertPublicCatalogueOmitsEligibility(live.server.url);
});

test("Serve replaces route eligibility with a watched runtime generation", async (t) => {
  const live = await interactiveServerFixture({ source: eligibilitySource() });
  t.after(() => removeInteractiveFixture(live.fixture));
  const replacement = new Map(
    [...eligibilityById].map(([id, eligible]) => [id, !eligible]),
  );

  live.server.replaceComponentRuntime({
    ...live.runtime,
    generation: "b".repeat(32),
    interactiveEntries: Object.fromEntries(
      Object.entries(live.runtime.interactiveEntries).map(([id, eligible]) => [
        id,
        !eligible,
      ]),
    ),
  });

  await assertEligibility(live.server.url, replacement);
});

test("Serve keeps Static routes available when Live eligibility is unknown", async (t) => {
  const live = await interactiveServerFixture({ source: eligibilitySource() });
  t.after(() => removeInteractiveFixture(live.fixture));
  const ids = ["home", "action"] as const;
  const entries = ids.map((id) => {
    const entry = live.runtime.manifest.entries.find(
      (candidate) =>
        (candidate.kind === "screen" || candidate.kind === "component") &&
        candidate.path === id,
    );
    assert.ok(entry);
    assert.ok(entry.kind === "screen" || entry.kind === "component");
    return entry;
  });
  const interactiveEntries = live.runtime.interactiveEntries as Record<
    string,
    boolean
  >;
  for (const entry of entries) delete interactiveEntries[entry.path];

  for (const entry of entries) {
    for (let request = 0; request < 2; request += 1) {
      const route = `${entry.path}/`;
      const response = await fetch(`${live.server.url}/view/${route}`);
      assert.equal(response.status, 200, route);
      const descriptor = scriptValue(
        await response.text(),
        "data-mokly-host-capability-state",
      ) as { workspace?: RoutedWorkspace };
      assert.ok(descriptor.workspace, route);
      assert.equal("interactive" in descriptor.workspace, false, route);
    }
  }

  assert.equal(live.diagnostics.length, entries.length);
  for (const entry of entries) {
    const matching = live.diagnostics.filter((diagnostic) =>
      String(diagnostic).includes(entry.path),
    );
    assert.equal(matching.length, 1, entry.path);
    assert.match(String(matching[0]), new RegExp(live.generation));
  }
});

async function assertEligibility(
  origin: string,
  expected: ReadonlyMap<string, boolean>,
): Promise<void> {
  for (const [id, interactive] of expected) {
    const kind = id === "action" || id === "pane" ? "component" : "screen";
    const route = `${id}/`;
    const response = await fetch(`${origin}/view/${route}`);
    assert.equal(response.status, 200, route);
    const html = await response.text();
    const descriptor = scriptValue(
      html,
      "data-mokly-host-capability-state",
    ) as { workspace?: RoutedWorkspace };
    const workspace = descriptor.workspace;
    assert.ok(workspace, route);
    assert.equal(workspace.entry.path, id);
    assert.equal(workspace.entry.kind, kind);
    assert.equal(workspace.interactive, interactive, route);
    assert.equal("interactive" in workspace.entry, false, route);

    const rendered = scriptValue(
      html,
      "data-workspace-data",
    ) as RoutedWorkspace;
    assert.equal("interactive" in rendered, false, route);
    assert.equal("interactive" in rendered.entry, false, route);
  }
}

async function assertPublicCatalogueOmitsEligibility(
  origin: string,
): Promise<void> {
  const response = await fetch(`${origin}/__mokly/catalogue.json`);
  assert.equal(response.status, 200);
  assert.doesNotMatch(await response.text(), /"interactive"/);
}

function scriptValue(html: string, attribute: string): unknown {
  const match = new RegExp(
    `<script[^>]*${attribute}=""[^>]*>([^<]+)</script>`,
  ).exec(html);
  assert.ok(match, attribute);
  return JSON.parse(match[1]!);
}

interface RoutedWorkspace {
  entry: { path: string; kind: "component" | "screen"; [key: string]: unknown };
  interactive?: boolean;
}

function eligibilitySource(): string {
  return componentEntrySource({
    exports: `...action.entries, ...pane.entries,
  defineScreen({ ...metadata, path: "details", title: "Details", description: "An eligible screen", mobile: <main>Details</main>, desktop: <main>Details</main> }),`,
  })
    .replace(
      "const action = defineComponent({ ...metadata,",
      "const action = defineComponent({ ...metadata, interactive: false,",
    )
    .replace(
      'defineScreen({ ...metadata, path: "home"',
      'defineScreen({ ...metadata, interactive: false, path: "home"',
    );
}
