/**
 * The setup destinations: every link whose destination depends on whether the
 * workspace has a connected GitHub account, or on whether the new project can
 * build, takes that fact explicitly and lands on a drawing that agrees with it.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cliForm,
  projectCreated,
  setupStep,
} from "../screens/product/setup-destinations";
import type { Installation } from "../screens/product/setup-destinations";
import { destination, drawnPage, links, stepsDone } from "./drawn-page";
import { inventoryPages } from "./product-inventory";

const installations: readonly Installation[] = [
  "connected",
  "suspended",
  "absent",
];

test("each destination is a drawn page chosen by the context it is given", () => {
  const drawn = new Set(inventoryPages().map(({ path }) => path));
  for (const installation of installations)
    for (const path of [setupStep(installation), cliForm(installation)])
      assert.ok(drawn.has(path), installation + " " + path);
  for (const builds of ["available", "unavailable"] as const)
    assert.ok(drawn.has(projectCreated(builds)), builds);
  assert.deepEqual(installations.map(setupStep), [
    "product/account/choose-repository",
    "product/account/install-app",
    "product/account/install-app",
  ]);
  assert.deepEqual(installations.map(cliForm), [
    "product/account/choose-repository/cli",
    "product/account/choose-repository/cli/empty",
    "product/account/choose-repository/cli/empty",
  ]);
  assert.equal(projectCreated("available"), "product/account/project-created");
  assert.equal(
    projectCreated("unavailable"),
    "product/account/project-created/empty",
  );
});

test("the CLI form a workspace reaches goes back where it came from and claims only what is done", () => {
  for (const installation of installations)
    for (const viewport of ["desktop", "mobile"] as const) {
      const form = drawnPage(cliForm(installation), viewport);
      assert.deepEqual(
        links(form, "Back").map(destination),
        [setupStep(installation)],
        installation,
      );
      assert.equal(
        stepsDone(form),
        installation === "connected" ? 2 : 1,
        installation,
      );
    }
});

test("each creation link lands on the finished project its build context draws", () => {
  for (const viewport of ["desktop", "mobile"] as const) {
    assert.deepEqual(
      links(
        drawnPage("product/account/choose-repository", viewport),
        "Create project",
      ).map(destination),
      [projectCreated("available")],
    );
    assert.deepEqual(
      links(
        drawnPage("product/account/choose-repository/cli", viewport),
        "Create project",
      ).map(destination),
      [projectCreated("unavailable")],
    );
  }
});
