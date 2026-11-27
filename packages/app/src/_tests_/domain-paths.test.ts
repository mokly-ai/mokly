import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { callbackLandings } from "../navigation/callback-input";
import type { CallbackLanding } from "../navigation/callback-input";
import { dashboardPath, signInPath, signUpPath } from "../navigation/paths";

const repository = path.resolve(import.meta.dirname, "../../../..");

function quotedValue(source: string, pattern: RegExp, label: string): string {
  const value = pattern.exec(source)?.[1];
  assert.ok(value, `${label} must be declared as a quoted path`);
  return value;
}

test("Rust and Expo share root-relative application paths", async () => {
  const [manifestSource, rustSource] = await Promise.all([
    readFile(path.join(repository, "packages/app/app.json"), "utf8"),
    readFile(
      path.join(repository, "crates/mkc-domain/src/app_paths.rs"),
      "utf8",
    ),
  ]);
  const manifest = JSON.parse(manifestSource) as {
    expo?: { experiments?: { baseUrl?: string } };
  };
  assert.equal(manifest.expo?.experiments?.baseUrl, undefined);
  for (const [name, appPath] of [
    ["SIGN_IN", signInPath],
    ["SIGN_UP", signUpPath],
    ["DASHBOARD", dashboardPath],
  ] as const) {
    const rustPath = quotedValue(
      rustSource,
      new RegExp(`pub const ${name}: &str = "([^"]+)"`),
      `mkc_domain::app_paths::${name}`,
    );
    assert.equal(appPath, rustPath);
    assert.ok(appPath.startsWith("/") && !appPath.startsWith("/app/"));
  }
});

test("the landings the entry captures are the ones the API links to", async () => {
  const rustSource = await readFile(
    path.join(repository, "crates/mkc-domain/src/app_paths.rs"),
    "utf8",
  );
  // The API links to every landing but the desktop app's, whose address the
  // desktop shell loads; the scheme test of `desktop-sign-in` pins that one.
  const constants: Record<Exclude<CallbackLanding, "desktop">, string> = {
    email: "EMAIL_CALLBACK",
    "github-callback": "GITHUB_CALLBACK",
    "github-install": "GITHUB_INSTALL",
  };
  for (const [landing, constant] of Object.entries(constants)) {
    const { route } = callbackLandings[landing as CallbackLanding];
    assert.equal(
      route,
      quotedValue(
        rustSource,
        new RegExp(`${constant}: &str = "([^"]+)"`),
        `mkc_domain::app_paths::${constant}`,
      ),
    );
  }
  for (const { route } of Object.values(callbackLandings)) {
    await access(path.join(repository, "packages/app/app", `${route}.tsx`));
  }
});
