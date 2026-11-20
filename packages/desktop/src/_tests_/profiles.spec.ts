import { randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { expect, test } from "@playwright/test";

import { profileDirectory } from "./shell";

/** Reproduce the empty scratch tree supplied by a fresh hosted runner. */
test("a fresh scratch parent can hold an isolated Electron profile", () => {
  const label = "fresh-profile-" + randomUUID();
  const parent = resolve("../../.context/m5", label);
  expect(existsSync(parent)).toBe(false);
  try {
    const profile = profileDirectory(label + "/session");
    expect(dirname(profile)).toBe(parent);
    expect(existsSync(profile)).toBe(true);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
