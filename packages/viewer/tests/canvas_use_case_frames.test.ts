import assert from "node:assert/strict";
import { test } from "node:test";

import type { CatalogueReadModel } from "@mokly/model";

import {
  openingUseCaseChoice,
  useCaseFrames,
  type UseCaseFramePlan,
} from "../src/shell/canvas_use_case_frames.js";

import { indexFixture, shellModelFixture } from "./catalogue_v9_fixture.js";

/** Give the Details screen of the fixture a dark render of each view. */
function withDarkDetails(index: CatalogueReadModel): void {
  const details = index.screens.find(
    (screen) => screen.path === "product/browse/details",
  )!;
  details.colorSchemes = ["light", "dark"];
  details.views = details.views.flatMap((view) => [
    view,
    { ...view, colorScheme: "dark" as const },
  ]);
}

/** The fixture's use case, its two step screens, and their frames. */
function tourFrames(
  choice: Parameters<typeof useCaseFrames>[2],
  edit?: (index: CatalogueReadModel) => void,
) {
  const model = shellModelFixture(indexFixture(edit));
  const tour = model.useCases.find((useCase) => useCase.path === "tour");
  assert.ok(tour);
  return useCaseFrames(model.screens, tour, choice);
}

/** What a reader sees of each step frame, and the view that it shows. */
function shown(frames: readonly UseCaseFramePlan[]) {
  return frames.map((frame) => ({
    cell: [frame.column, frame.row],
    description: frame.step.description,
    key: frame.key,
    label: frame.label,
    lightOnly: frame.step.lightOnly,
    scheme: frame.scheme,
    screen: frame.entry.path,
    title: frame.step.title,
    view: frame.view && `${frame.view.viewport} ${frame.view.colorScheme}`,
  }));
}

test("a use case opens on Desktop and Light at the layout breakpoint, and on Mobile and Light below it", () => {
  assert.deepEqual(openingUseCaseChoice(true), {
    scheme: "light",
    viewport: "desktop",
  });
  assert.deepEqual(openingUseCaseChoice(false), {
    scheme: "light",
    viewport: "mobile",
  });
});

test("a use case's steps stand in step order in one row, each named by its number and title", () => {
  assert.deepEqual(
    shown(tourFrames({ scheme: "light", viewport: "desktop" })),
    [
      {
        cell: [0, 0],
        description: "The landing screen.",
        key: "step-0",
        label: "1 · Start",
        lightOnly: false,
        scheme: "light",
        screen: "product/browse/home",
        title: "Start",
        view: "desktop light",
      },
      {
        cell: [1, 0],
        description: "Details for one item.",
        key: "step-1",
        label: "2 · Details",
        lightOnly: false,
        scheme: "light",
        screen: "product/browse/details",
        title: "Details",
        view: "desktop light",
      },
    ],
  );
  // The compact layout shows each step's Mobile view.
  assert.deepEqual(
    tourFrames({ scheme: "light", viewport: "mobile" }).map(
      ({ kind, view }) => [kind, view?.viewport],
    ),
    [
      ["mobile", "mobile"],
      ["mobile", "mobile"],
    ],
  );
});

test("under Dark, a step whose screen has no dark view keeps its Light view and says so", () => {
  const frames = tourFrames(
    { scheme: "dark", viewport: "desktop" },
    withDarkDetails,
  );
  assert.deepEqual(
    frames.map((frame) => ({
      label: frame.label,
      lightOnly: frame.step.lightOnly,
      scheme: frame.scheme,
      view: frame.view && `${frame.view.viewport} ${frame.view.colorScheme}`,
    })),
    [
      {
        label: "1 · Start",
        lightOnly: true,
        scheme: "light",
        view: "desktop light",
      },
      {
        label: "2 · Details",
        lightOnly: false,
        scheme: "dark",
        view: "desktop dark",
      },
    ],
  );
});

test("a step whose screen the catalogue does not hold has no frame, and the row closes up", () => {
  const model = shellModelFixture(indexFixture());
  const tour = model.useCases.find((useCase) => useCase.path === "tour");
  assert.ok(tour);
  const frames = useCaseFrames(
    model.screens.filter((screen) => screen.path !== "product/browse/home"),
    tour,
    { scheme: "light", viewport: "desktop" },
  );
  assert.deepEqual(
    frames.map(({ column, label, step }) => [column, label, step.index]),
    [[0, "2 · Details", 1]],
  );
});
