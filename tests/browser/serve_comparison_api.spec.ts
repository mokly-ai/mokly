import fs from "node:fs/promises";
import path from "node:path";

import { expect } from "@playwright/test";

import { git } from "../helpers/static_changes.js";

import { test } from "./serve_comparison_test.js";

test("the Serve fixture rejects an unchanged edit without changing source bytes", async ({
  changes,
}) => {
  const file = `specs/${changes.paths.changed}.screen.html`;
  const original = await fs.readFile(path.join(changes.root, file), "utf8");
  const index = await changes.index();
  await expect(changes.edit(file, original)).rejects.toThrow(
    `Unchanged fixture source: ${file}`,
  );
  expect(await fs.readFile(path.join(changes.root, file), "utf8")).toBe(
    original,
  );
  expect((await changes.index()).revision).toBe(index.revision);
});

test("the Serve fixture waits for false and asynchronous semantic predicates", async ({
  changes,
}) => {
  const previous = await changes.index();
  let release = () => {};
  const allowed = new Promise<void>((resolve) => {
    release = resolve;
  });
  const observations: string[] = [];
  let gated = false;
  let settled = false;
  let failure: unknown;
  const title = (index: typeof previous) =>
    index.screens.find((entry) => entry.path === changes.paths.changed)!.title;
  const pending = changes
    .edit(
      `specs/${changes.paths.changed}.screen.html`,
      "---\ntitle: Accepted screen\n---\n<h1>Accepted body</h1>",
      async (index) => {
        observations.push(title(index));
        if (observations.length === 1 || title(index) !== "Accepted screen")
          return false;
        gated = true;
        await allowed;
        return true;
      },
    )
    .then(
      (index) => {
        settled = true;
        return index;
      },
      (error: unknown) => {
        failure = error;
        return undefined;
      },
    );
  try {
    await expect
      .poll(() => {
        if (failure) throw failure;
        return gated;
      })
      .toBe(true);
    expect(observations.length).toBeGreaterThan(1);
    expect(observations.at(-1)).toBe("Accepted screen");
    expect(settled).toBe(false);
    release();
    const accepted = await pending;
    if (failure) throw failure;
    expect(accepted!.revision).toBeGreaterThan(previous.revision);
    expect(title(accepted!)).toBe("Accepted screen");
    const ready = await changes.ready(
      previous.revision,
      changes.baseCommit,
      (index) => title(index) === "Accepted screen",
    );
    expect(ready.revision).toBeGreaterThanOrEqual(accepted!.revision);
  } finally {
    release();
    await pending;
  }
});

test("the Serve fixture accepts a third base commit and restores the original base", async ({
  request,
  changes,
}) => {
  const before = await changes.index();
  await git(
    changes.root,
    "commit",
    "--allow-empty",
    "-qm",
    "Third fixture commit",
  );
  const third = await git(changes.root, "rev-parse", "HEAD");
  expect(third).not.toBe(changes.baseCommit);
  expect(third).not.toBe(changes.headCommit);
  const selected = await changes.moveBase(third);
  expect(
    (
      await (
        await request.get(new URL(selected.comparisonUrl!, changes.url).href)
      ).json()
    ).baseCommit,
  ).toBe(third);
  expect(selected.removedEntries).toEqual([]);
  const same = await changes.moveBase(third);
  expect(same.comparisonUrl).toBe(selected.comparisonUrl);
  const restored = await changes.moveBase("base");
  expect(restored.removedEntries).toEqual(before.removedEntries);
});
