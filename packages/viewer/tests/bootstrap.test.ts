import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { readCatalogue } from "../src/catalogue/reader.js";
import type { StaticDelivery } from "../src/navigation/delivery.js";
import {
  readShellBootstrap,
  serializeShellBootstrap,
  shellBootstrap,
  shellBootstrapWithDelivery,
} from "../src/standalone/bootstrap.js";
import { viewerCatalogue, viewerView } from "../src/viewer/projection.js";
import { viewerContext } from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";

const catalogue = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);

test("static hydration adopts the finalized authenticated deployment", () => {
  const staged = readShellBootstrap({
    catalogue: { ...catalogue, deploymentId: "0".repeat(64) },
    context: {
      base: "main",
      comparisons: false,
      updateVersion: 0,
      delivery: {
        schemaVersion: 2,
        deploymentId: "0".repeat(64),
        canonicalPath: "/",
        comparisonUrl: null,
        idRoutes: {},
      },
    },
    view: { kind: "home" },
  });
  const delivery: StaticDelivery = {
    schemaVersion: 2,
    deploymentId: "a".repeat(64),
    canonicalPath: "/",
    comparisonUrl: null,
    idRoutes: {},
  };
  const finalized = shellBootstrapWithDelivery(staged, delivery);
  assert.equal(staged.catalogue.deploymentId, "0".repeat(64));
  assert.equal(staged.context.delivery?.deploymentId, "0".repeat(64));
  assert.equal(finalized.catalogue.deploymentId, "a".repeat(64));
  assert.equal(finalized.context.delivery, delivery);
});

test("the React host projection never selects the temporary standalone switch", () => {
  const context = viewerContext(catalogue, defaultSelection);
  assert.equal(context.reactShell, undefined);
  assert.equal(Object.hasOwn(context, "reactShell"), false);
});

test("validated shell bootstrap JSON retains its canonical bytes", () => {
  const display = viewerCatalogue(catalogue);
  const bootstrap = shellBootstrap(
    catalogue,
    viewerView(display, { ...defaultSelection, screenId: "home" }),
    {
      base: "origin/main",
      comparisons: false,
      updateVersion: 2,
    },
  );
  const serialized = serializeShellBootstrap(bootstrap);
  assert.equal(
    serializeShellBootstrap(readShellBootstrap(JSON.parse(serialized))),
    serialized,
  );
});
