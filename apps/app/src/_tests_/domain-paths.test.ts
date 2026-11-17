import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { dashboardPath, signInPath, signUpPath } from "../navigation/paths";
import { callbackLandings } from "../navigation/callback-input";
import type { CallbackLanding } from "../navigation/callback-input";
import { desktopClient } from "../navigation/desktop-shell";

const repository = path.resolve(import.meta.dirname, "../../../..");

function quotedValue(source: string, pattern: RegExp, label: string): string {
  const value = pattern.exec(source)?.[1];
  assert.ok(value, `${label} must be declared as a quoted path`);
  return value;
}

test("Rust and Expo share root-relative application paths", async () => {
  const [manifestSource, rustSource] = await Promise.all([
    readFile(path.join(repository, "apps/app/app.json"), "utf8"),
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
  const constants: Record<CallbackLanding, string> = {
    email: "EMAIL_CALLBACK",
    preview: "PREVIEW_CALLBACK",
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
    await access(path.join(repository, "apps/app/app", `${route}.tsx`));
  }
});

test("the email link the shell requests carries the query the landing reads", async () => {
  const rustSource = await readFile(
    path.join(repository, "crates/mkc-domain/src/app_paths.rs"),
    "utf8",
  );
  const link = new URL(
    quotedValue(
      rustSource,
      /EMAIL_DESKTOP_CALLBACK: &str = "([^"]+)"/,
      "mkc_domain::app_paths::EMAIL_DESKTOP_CALLBACK",
    ),
    "https://app.test",
  );
  assert.equal(link.pathname, callbackLandings.email.route);
  assert.deepEqual(
    [...link.searchParams],
    [[desktopClient.key, desktopClient.value]],
  );
});
