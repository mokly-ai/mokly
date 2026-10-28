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
  let signalGated = () => {};
  const gated = new Promise<void>((resolve) => {
    signalGated = resolve;
  });
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
        signalGated();
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
    await Promise.race([gated, pending]);
    if (failure) throw failure;
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
  const historical = (index: typeof before) =>
    new URL(
      `snapshots/before/mokly-generated/${changes.paths.removedScreen}/index.desktop.html`,
      new URL(index.comparisonUrl!, changes.url),
    ).href;
  const original = await (await request.get(historical(before))).text();
  expect(original).toContain("<h1>Historical screen</h1>");
  const status = await git(changes.root, "status", "--porcelain");
  const indexTree = await git(changes.root, "write-tree");
  const file = `specs/${changes.paths.removedScreen}.screen.html`;
  const contents =
    "---\ntitle: Retired screen\n---\n<h1>Third historical screen</h1>";
  const third = await changes.commitBase({
    [file]: contents,
    "base-note.txt": "Only in the third base",
    "specs/notes/retired.md": null,
  });
  expect(third).not.toBe(changes.baseCommit);
  expect(third).not.toBe(changes.headCommit);
  expect(await git(changes.root, "rev-parse", `${third}^`)).toBe(
    changes.baseCommit,
  );
  expect(await git(changes.root, "show", `${third}:${file}`)).toBe(contents);
  expect(await git(changes.root, "show", `${third}:base-note.txt`)).toBe(
    "Only in the third base",
  );
  expect(
    await git(changes.root, "ls-tree", third, "--", "specs/notes/retired.md"),
  ).toBe("");
  expect(await git(changes.root, "rev-parse", "HEAD")).toBe(changes.headCommit);
  expect(await git(changes.root, "write-tree")).toBe(indexTree);
  expect(await git(changes.root, "status", "--porcelain")).toBe(status);
  await expect(fs.stat(path.join(changes.root, file))).rejects.toMatchObject({
    code: "ENOENT",
  });
  const sibling = await changes.moveBase(third);
  expect(sibling.comparisonUrl).toBe(before.comparisonUrl);
  expect(sibling.removedEntries).toEqual(before.removedEntries);
  const atHead = await changes.moveBase("head");
  expect(atHead.removedEntries).toEqual([]);
  const joinedHead = await git(
    changes.root,
    "commit-tree",
    indexTree,
    "-p",
    changes.headCommit,
    "-p",
    third,
    "-m",
    "Join third base without changing current sources",
  );
  await git(changes.root, "update-ref", "HEAD", joinedHead, changes.headCommit);
  const selected = await changes.moveBase(third);
  expect(selected.baseCommit).toBe(third);
  expect(await (await request.get(historical(selected))).text()).toContain(
    "<h1>Third historical screen</h1>",
  );
  expect(historical(selected)).not.toBe(historical(before));
  expect(await (await request.get(historical(before))).text()).toBe(original);
  const same = await changes.moveBase(third);
  expect(same.comparisonUrl).toBe(selected.comparisonUrl);
  const restored = await changes.moveBase("base");
  expect(restored.removedEntries).toEqual(before.removedEntries);
  expect(await (await request.get(historical(restored))).text()).toBe(original);
  expect(await git(changes.root, "rev-parse", "HEAD")).toBe(joinedHead);
  expect(await git(changes.root, "write-tree")).toBe(indexTree);
  expect(await git(changes.root, "status", "--porcelain")).toBe(status);
});
