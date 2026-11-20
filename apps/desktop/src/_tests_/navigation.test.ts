import assert from "node:assert/strict";
import test from "node:test";

import type { WebContents } from "electron";

import { safeDiagnostic } from "../diagnostics.js";
import { installNavigation, navigationTarget } from "../navigation.js";

import { navigationError } from "./navigation-error.js";

const app = "https://mokly.example";
test("navigation permits only the desktop origin in the window", () => {
  assert.deepEqual(navigationTarget("mokly-app://desktop/dashboard", app), {
    action: "allow",
  });
  for (const url of [
    "file:///etc/passwd",
    "smb://share/path",
    "mokly://auth/desktop/callback",
    "javascript:alert(1)",
    "data:text/html,test",
    "mokly-app://other/",
    "mokly-app://desktop:80/",
    "https://name:secret@example.com",
    "bad",
    "about:blank",
  ]) {
    assert.deepEqual(navigationTarget(url, app), { action: "drop" });
  }
  for (const url of [
    "https://checkout.stripe.com/c/pay",
    "https://billing.stripe.com/p/session",
    "https://github.com/login",
    "https://github.com.evil.example/",
    "https://github.com:444/",
    "http://github.com/",
    "https://example.com/",
    "https://p-id.catalogue.example/",
  ]) {
    assert.deepEqual(navigationTarget(url, app), { action: "external", url });
  }
});

test("public product targets preserve their complete path, query and fragment", () => {
  const path =
    "/acme/project?view=changes&search=a%2Bb&tag=one&tag=two#selection";
  assert.deepEqual(navigationTarget(app + path, app), {
    action: "load",
    url: "mokly-app://desktop" + path,
  });
  for (const path of [
    "/",
    "/docs/publish",
    "/%64ocs/publish",
    "/terms",
    "/changelog?release=latest",
    "/favicon.svg",
  ]) {
    assert.deepEqual(navigationTarget(app + path, app), {
      action: "external",
      url: app + path,
    });
  }
  assert.equal(navigationTarget(app + "/docs-project/web", app).action, "load");
  assert.equal(navigationTarget(app + "/%ZZ", app).action, "drop");
});

test("public app popups open externally and desktop popups load in the window", () => {
  for (const path of [
    "/acme/project?view=changes#selection",
    "/connect/desktop?challenge=challenge&returnTo=%2Fdashboard",
    "/docs/publish",
  ]) {
    assert.deepEqual(navigationTarget(app + path, app, true), {
      action: "external",
      url: app + path,
    });
  }
  assert.deepEqual(
    navigationTarget(
      "mokly-app://desktop/acme/web?view=changes#selection",
      app,
      true,
    ),
    {
      action: "load",
      url: "mokly-app://desktop/acme/web?view=changes#selection",
    },
  );
});

test("every popup is denied and its target uses the browser or existing window", () => {
  const callbacks = new Map<
    string,
    (event: {
      url: string;
      isMainFrame: boolean;
      preventDefault(): void;
    }) => void
  >();
  let popup: (details: { url: string }) => { action: string } = () => ({
    action: "allow",
  });
  const loaded: string[] = [];
  const external: string[] = [];
  const contents = {
    on: (
      name: string,
      callback: (event: {
        url: string;
        isMainFrame: boolean;
        preventDefault(): void;
      }) => void,
    ) => {
      callbacks.set(name, callback);
    },
    setWindowOpenHandler: (handler: typeof popup) => {
      popup = handler;
    },
  } as unknown as Pick<WebContents, "on" | "setWindowOpenHandler">;
  installNavigation(contents, app, {
    load: async (url) => {
      loaded.push(url);
    },
    openExternal: async (url) => {
      external.push(url);
    },
    warn: assert.fail,
  });
  for (const name of ["will-navigate", "will-redirect"]) {
    let prevented = 0;
    callbacks.get(name)!({
      url: app + "/auth/github/callback?code=c&state=s",
      isMainFrame: true,
      preventDefault: () => {
        prevented++;
      },
    });
    assert.equal(prevented, 1);
  }
  let prevented = 0;
  callbacks.get("will-navigate")!({
    url: "https://billing.stripe.com/p/session",
    isMainFrame: true,
    preventDefault: () => {
      prevented++;
    },
  });
  assert.equal(prevented, 1);
  for (const target of [
    app + "/acme/web",
    app + "/docs",
    "https://github.com/login",
    "https://checkout.stripe.com/c/pay",
    "file:///secret",
    "mokly-app://desktop/sign-in",
  ]) {
    assert.deepEqual(popup({ url: target }), { action: "deny" });
  }
  assert.deepEqual(external, [
    "https://billing.stripe.com/p/session",
    app + "/acme/web",
    app + "/docs",
    "https://github.com/login",
    "https://checkout.stripe.com/c/pay",
  ]);
  assert.deepEqual(loaded, [
    "mokly-app://desktop/auth/github/callback?code=c&state=s",
    "mokly-app://desktop/auth/github/callback?code=c&state=s",
    "mokly-app://desktop/sign-in",
  ]);
  const count = loaded.length;
  callbacks.get("will-redirect")!({
    url: app + "/project",
    isMainFrame: false,
    preventDefault: assert.fail,
  });
  assert.equal(loaded.length, count);
});

test("a failed rewritten provider callback keeps credentials out of warnings", async () => {
  let navigate: (event: {
    url: string;
    preventDefault(): void;
  }) => void = () => {};
  const warnings: string[] = [];
  const code = "provider-credential";
  const contents = {
    on: (event: string, listener: typeof navigate) => {
      if (event === "will-navigate") navigate = listener;
    },
    setWindowOpenHandler: () => {},
  } as unknown as Pick<WebContents, "on" | "setWindowOpenHandler">;
  installNavigation(contents, app, {
    load: async (url) => {
      throw navigationError(url);
    },
    openExternal: async () => {},
    warn: (error) => {
      warnings.push(safeDiagnostic(error));
    },
  });
  navigate({
    url: app + "/auth/github/callback?code=" + code,
    preventDefault: () => {},
  });
  await Promise.resolve();
  assert.equal(warnings.length, 1);
  assert.equal(
    warnings.some((line) => line.includes(code)),
    false,
  );
  assert.equal(warnings[0], "Desktop operation failed (ERR_ABORTED)");
});
