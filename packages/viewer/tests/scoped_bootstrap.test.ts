import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { test } from "node:test";

import { readCatalogue } from "../src/catalogue/reader.js";
import { projectScopedCatalogue } from "../src/catalogue/scoped_projection.js";
import {
  serializeShellBootstrap,
  type ShellBootstrapView,
} from "../src/standalone/bootstrap.js";
import { readScopedShellBootstrap } from "../src/standalone/scoped_bootstrap.js";
import {
  readLiveShellBootstrap,
  readLiveShellBootstrapState,
} from "../src/standalone/scoped_bootstrap.js";

import { scopedCatalogueFixture } from "./scoped_catalogue_fixture.js";

const model = scopedCatalogueFixture();
const context = {
  base: "origin/main",
  comparisons: true,
  updateVersion: 7,
};

test("scoped bootstraps for every route shape round-trip canonical bytes", () => {
  const views: ShellBootstrapView[] = [
    { kind: "home" },
    { kind: "missing", requested: "not-here.html" },
    ...model.screens.map(({ route }) => ({ kind: "target" as const, route })),
    ...model.components.map(({ route }) => ({
      kind: "target" as const,
      route,
    })),
    ...model.useCases.map(({ route }) => ({ kind: "target" as const, route })),
    ...model.pages.map(({ route }) => ({ kind: "target" as const, route })),
    ...model.removedEntries.map(({ entry }) => ({
      kind: "target" as const,
      route: entry.route,
    })),
  ];
  for (const view of views) {
    const bytes = scopedBytes(view);
    const parsed = readScopedShellBootstrap(JSON.parse(bytes));
    assert.equal(serializeShellBootstrap(parsed), bytes, JSON.stringify(view));
  }
});

test("the live reader accepts only exact route scope", () => {
  const view = { kind: "target" as const, route: "screens/home.html" };
  const complete = { catalogue: model, context, view };
  const scoped = JSON.parse(scopedBytes(view));
  assert.deepEqual(
    readLiveShellBootstrap(scoped),
    readScopedShellBootstrap(scoped),
  );
  assert.throws(
    () => readLiveShellBootstrap(complete),
    /out-of-scope usage must be omitted/i,
  );

  const hybrid = JSON.parse(scopedBytes(view));
  hybrid.catalogue.components[0].variants[0].views[0].usage =
    model.components[0]!.variants[0]!.views[0]!.usage;
  assert.throws(
    () => readLiveShellBootstrap(hybrid),
    /out-of-scope usage must be omitted/i,
  );
});

test("the live state reader leaves static external references unchanged", () => {
  const external = {
    catalogue: {
      identity: model.identity.id,
      kind: "external",
      path: "/__mokly/catalogue.json",
      revision: model.revision,
    },
    context,
    view: { kind: "home" as const },
  };
  assert.deepEqual(readLiveShellBootstrapState(external), external);
});

test("public catalogue reading still rejects shell-only omitted usage", () => {
  const value = JSON.parse(
    scopedBytes({ kind: "target", route: "screens/home.html" }),
  );
  assert.throws(
    () => readCatalogue(value.catalogue),
    /unsupported discriminant/i,
  );
});

test("scoped reader rejects omitted usage on the selected route", () => {
  const value = screenBootstrapValue();
  value.catalogue.screens[0].views[0].usage = { status: "omitted" };
  assert.throws(
    () => readScopedShellBootstrap(value),
    /in-scope usage cannot be omitted/i,
  );
});

test("scoped reader rejects leaked usage from another entry", () => {
  const value = screenBootstrapValue();
  value.catalogue.components[0].variants[0].views[0].usage =
    model.components[0]!.variants[0]!.views[0]!.usage;
  assert.throws(
    () => readScopedShellBootstrap(value),
    /out-of-scope usage must be omitted/i,
  );
});

test("scoped reader rejects missing and evidence-carrying omitted usage", () => {
  const missing = screenBootstrapValue();
  delete missing.catalogue.components[0].variants[0].views[0].usage;
  assert.throws(() => readScopedShellBootstrap(missing));

  const malformed = screenBootstrapValue();
  malformed.catalogue.components[0].variants[0].views[0].usage = {
    instances: [],
    ranges: [],
    slots: [],
    status: "omitted",
  };
  assert.throws(
    () => readScopedShellBootstrap(malformed),
    /cannot carry ready evidence/i,
  );
});

test("scoped reader retains index, hierarchy, axis, path and snapshot checks", () => {
  const mutations = [
    (value: ReturnType<typeof screenBootstrapValue>) => {
      value.catalogue.collections[0].childIds.push("missing-entry");
    },
    (value: ReturnType<typeof screenBootstrapValue>) => {
      value.catalogue.tree.pages = [];
    },
    (value: ReturnType<typeof screenBootstrapValue>) => {
      value.catalogue.screens[0].views.pop();
    },
    (value: ReturnType<typeof screenBootstrapValue>) => {
      value.catalogue.screens[0].views[0].fragmentPath = "static/wrong.html";
    },
    (value: ReturnType<typeof screenBootstrapValue>) => {
      value.catalogue.removedEntries[1].snapshotId =
        value.catalogue.removedEntries[0].snapshotId;
    },
  ];
  for (const mutate of mutations) {
    const value = screenBootstrapValue();
    mutate(value);
    assert.throws(() => readScopedShellBootstrap(value), String(mutate));
  }
});

test("scoped reader rejects unknown targets and complete live bootstraps", () => {
  const unknown = screenBootstrapValue();
  unknown.view.route = "screens/not-present.html";
  assert.throws(() => readScopedShellBootstrap(unknown), /invalid.*target/i);
  assert.throws(
    () =>
      readScopedShellBootstrap({
        catalogue: model,
        context,
        view: { kind: "target", route: "screens/home.html" },
      }),
    /out-of-scope usage must be omitted/i,
  );
});

test("the canonical public v1 fixture bytes remain unchanged", () => {
  const bytes = fs.readFileSync(
    new URL(
      "../../../docs/protocol/fixtures/catalogue-v1.json",
      import.meta.url,
    ),
  );
  assert.equal(bytes.byteLength, 9_042);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    "1221b6d08e323de7fbbc71c0d470c60a80cbbc3f2330dc57e8479ae796e7e173",
  );
  assert.doesNotThrow(() => readCatalogue(JSON.parse(bytes.toString("utf8"))));
});

function scopedBytes(view: ShellBootstrapView): string {
  return serializeShellBootstrap({
    catalogue: projectScopedCatalogue(model, view),
    context,
    view,
  });
}

function screenBootstrapValue() {
  return JSON.parse(
    scopedBytes({ kind: "target", route: "screens/home.html" }),
  );
}
