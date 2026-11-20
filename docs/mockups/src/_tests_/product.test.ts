import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { exampleToken } from "../fixtures/product-states";

import { catalogueEntries } from "./catalogue-index";
import { screenFile } from "./catalogue-paths";
import { drawnPalette } from "./catalogue-reads";
import { variantParent } from "./catalogue-variants";
import {
  inventoryPages,
  productInventoryViolations,
  productPalette,
} from "./product-inventory";
import { repeatedStates } from "./product-situations";

test("every standard product screen owns canonical, empty, loading and error states", () => {
  const entries = catalogueEntries();
  assert.deepEqual(productInventoryViolations(entries, drawnPalette), []);
  for (const id of [
    "product/settings/project",
    "product/account/magic-link/empty",
    "product/account/sign-in/loading",
    "product/account/invitation-accept",
    "product/account/invitation-accept/open-error",
    "product/settings/danger/error",
    "product/viewer/standalone",
    "product/viewer/switcher/error",
  ]) {
    assert.ok(
      productInventoryViolations(
        entries.filter((entry) => entry.path !== id),
        drawnPalette,
      ).length,
      id,
    );
    assert.ok(
      productInventoryViolations(entries, (path) =>
        path === id ? "default" : drawnPalette(path),
      ).length,
      id,
    );
  }
  // A viewer page drawn in Folio, and another family's page drawn in Canvas,
  // are both in the wrong palette.
  for (const [id, wrong] of [
    ["product/viewer/standalone", "folio"],
    ["product/viewer/switcher/error", "folio"],
    ["product/settings/project", "canvas"],
    ["product/account/sign-in/loading", "canvas"],
  ] as const)
    assert.ok(
      productInventoryViolations(entries, (path) =>
        path === id ? wrong : drawnPalette(path),
      ).length,
      id + " " + wrong,
    );
  const variants = entries.filter(
    (entry) => variantParent(entry) === "product/settings/project",
  );
  assert.ok(
    productInventoryViolations(
      [
        ...entries.filter((entry) => !variants.includes(entry)),
        ...variants.reverse(),
      ],
      drawnPalette,
    ).length,
  );
  assert.ok(
    productInventoryViolations(
      entries.map((entry) =>
        entry.path === "product/settings/project/loading"
          ? { ...entry, variantOf: "product/settings/account" }
          : entry,
      ),
      drawnPalette,
    ).length,
  );
  assert.ok(
    productInventoryViolations(
      entries.map((entry) =>
        entry.path === "product/settings/billing/trial"
          ? { ...entry, path: "product/settings/trial" }
          : entry,
      ),
      drawnPalette,
    ).length,
  );
});

test("all 286 inventory pages render both widths and schemes with their stable identity", () => {
  let rendered = 0;
  for (const { path: id, state } of inventoryPages())
    for (const view of ["mobile", "desktop"] as const)
      for (const scheme of ["light", "dark"] as const) {
        const html = readFileSync(screenFile(id, view, scheme), "utf8");
        assert.ok(
          html.includes('class="' + productPalette(id) + '-scope"'),
          id,
        );
        assert.ok(html.includes('data-mkc-screen="' + id + '"'), id);
        if (!id.startsWith("product/viewer/"))
          assert.ok(!html.includes("<iframe"), id);
        const repeats = repeatedStates.some(
          (repeat) => repeat.screen + "/" + repeat.state === id,
        );
        if ((state === "loading" || state === "pending") && !repeats)
          assert.ok(html.includes('aria-busy="true"'), id);
        assert.equal(
          html.includes(exampleToken),
          id === "product/settings/tokens/create/reveal" ||
            id === "product/settings/tokens/create/copy",
          id + " secret boundary",
        );
        rendered += 1;
      }
  assert.equal(rendered / 4, 286);
});

test("a state child that repeats its canonical drawing says why", () => {
  for (const repeat of repeatedStates) {
    const page = inventoryPages().find(
      (entry) => entry.path === repeat.screen + "/" + repeat.state,
    );
    assert.ok(page, repeat.screen);
    const canonical = inventoryPages().find(
      (entry) => entry.path === repeat.screen,
    );
    assert.ok(canonical, repeat.screen);
    const body = (id: string) =>
      readFileSync(screenFile(id, "desktop"), "utf8")
        .slice(readFileSync(screenFile(id, "desktop"), "utf8").indexOf("<main"))
        .replaceAll(/ data-mkc-screen="[^"]*"/g, "")
        .replaceAll(
          / href="[^"]*"(?=[^>]* data-mokly-link=")/g,
          ' href="[logical]"',
        );
    assert.equal(body(page.path), body(canonical.path), repeat.screen);
    assert.ok(repeat.reason.length > 20, repeat.screen);
  }
});

test("the onboarding journey ends where the new project is set up", () => {
  const entries = catalogueEntries();
  const flow = entries.find(
    (entry) => entry.path === "flows/product-onboarding",
  );
  assert.equal(flow?.kind, "use-case");
  if (flow?.kind !== "use-case") return;
  assert.deepEqual(
    flow.steps.map((step) => step.screenPath),
    [
      "product/account/sign-up",
      "product/account/magic-link",
      "design/email/sign-in",
      "product/account/create-workspace",
      "product/account/install-app",
      "product/account/choose-repository",
      "product/account/project-created",
      "product/viewer/standalone/publish/publishing",
    ],
  );
  for (const step of flow.steps) {
    const screen = entries.find((entry) => entry.path === step.screenPath);
    assert.ok(
      screen?.kind === "screen" && screen.useCasePaths.includes(flow.path),
      step.screenPath,
    );
  }
  const html = readFileSync(
    screenFile("product/account/project-created", "desktop"),
    "utf8",
  );
  assert.ok(html.includes("Open project"));
  assert.ok(html.includes("Mokly is publishing main."));
  assert.ok(
    html.includes(
      'data-mokly-link="product/viewer/standalone/publish/publishing"',
    ),
  );
  assert.ok(!html.includes('data-mokly-link="workspace'));
  const landing = readFileSync(
    screenFile("product/viewer/standalone/publish/publishing", "desktop"),
    "utf8",
  );
  assert.ok(landing.includes("Publishing this branch"));
  assert.ok(landing.includes("fo-stage-canvas"));
  // A project with nothing publishing leads with the guide, and its Open
  // project opens the project's viewer, drawn here as the Set up publishing
  // stage of a project that cannot build.
  const idle = readFileSync(
    screenFile("product/account/project-created/empty", "desktop"),
    "utf8",
  );
  assert.ok(!idle.includes("Mokly is publishing"));
  assert.ok(idle.includes('data-mokly-link="product/viewer/standalone/empty"'));
  assert.ok(idle.indexOf(">Publish from CI<") < idle.indexOf(">Open project<"));
});
