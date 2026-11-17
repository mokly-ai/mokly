import assert from "node:assert/strict";
import { test } from "node:test";

import {
  captureCallbackInput,
  takeCallbackInput,
} from "../navigation/callback-input";

interface Meta {
  name: string;
  content: string;
}

interface Browser {
  address: () => string;
  writes: () => number;
  referrer: () => string | undefined;
}

/**
 * Run with a document loaded at `initial`: the address, the history writes it
 * takes and the head a referrer policy would land in are all this test's.
 */
function withDocument(initial: string, run: (browser: Browser) => void): void {
  const saved = ["window", "document"].map((name) => ({
    name,
    descriptor: Object.getOwnPropertyDescriptor(globalThis, name),
  }));
  let address = new URL(initial);
  let writes = 0;
  const state = { key: "router-entry" };
  const metas: Meta[] = [];
  const history = {
    state,
    replaceState(data: unknown, _unused: string, url?: string | URL | null) {
      assert.strictEqual(data, state, "the entry keeps its history state");
      writes += 1;
      if (url !== undefined && url !== null) address = new URL(url, address);
    },
  };
  const location = {
    get pathname() {
      return address.pathname;
    },
    get search() {
      return address.search;
    },
    get hash() {
      return address.hash;
    },
  };
  const head = {
    querySelector: (selector: string) =>
      selector === 'meta[name="referrer"]'
        ? (metas.find((meta) => meta.name === "referrer") ?? null)
        : null,
    prepend: (meta: Meta) => metas.unshift(meta),
  };
  const document = { head, createElement: () => ({ name: "", content: "" }) };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location, history },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: document,
  });
  try {
    run({
      address: () => address.href,
      writes: () => writes,
      referrer: () => metas.find((meta) => meta.name === "referrer")?.content,
    });
  } finally {
    for (const { name, descriptor } of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
}

test("a magic link's token leaves the fragment and the query stays", () => {
  withDocument(
    "https://app.test/auth/email/callback?source=mail#token=one",
    (browser) => {
      captureCallbackInput();
      assert.equal(
        browser.address(),
        "https://app.test/auth/email/callback?source=mail",
      );
      assert.equal(browser.writes(), 1);
      assert.equal(browser.referrer(), undefined);
      assert.equal(takeCallbackInput("email").get("token"), "one");
    },
  );
});

test("a preview secret leaves the fragment and the query stays", () => {
  withDocument(
    "https://app.test/auth/preview/callback?source=comment#secret=shared",
    (browser) => {
      captureCallbackInput();
      assert.equal(
        browser.address(),
        "https://app.test/auth/preview/callback?source=comment",
      );
      assert.equal(browser.writes(), 1);
      assert.equal(browser.referrer(), undefined);
      assert.equal(takeCallbackInput("preview").get("secret"), "shared");
    },
  );
});

test("a landing's input is handed to that landing, once", () => {
  withDocument(
    "https://app.test/auth/email/callback#token=one&token=two",
    () => {
      captureCallbackInput();
      assert.equal(takeCallbackInput("github-callback").toString(), "");
      assert.deepEqual(takeCallbackInput("email").getAll("token"), [
        "one",
        "two",
      ]);
      assert.equal(takeCallbackInput("email").toString(), "");
    },
  );
});

test("GitHub's query leaves both GitHub landings, which send no referrer", () => {
  withDocument(
    "https://app.test/auth/github/callback?code=provider-code&state=abc",
    (browser) => {
      captureCallbackInput();
      assert.equal(browser.address(), "https://app.test/auth/github/callback");
      assert.equal(browser.referrer(), "no-referrer");
      const input = takeCallbackInput("github-callback");
      assert.equal(input.get("code"), "provider-code");
      assert.equal(input.get("state"), "abc");
    },
  );
  withDocument(
    "https://app.test/auth/github/install/?installation_id=42&state=abc",
    (browser) => {
      captureCallbackInput();
      assert.equal(browser.address(), "https://app.test/auth/github/install/");
      assert.equal(browser.referrer(), "no-referrer");
      assert.equal(
        takeCallbackInput("github-install").get("installation_id"),
        "42",
      );
    },
  );
});

test("a stateless installation return becomes the connect situation", () => {
  for (const initial of [
    "https://app.test/auth/github/install?installation_id=42",
    "https://app.test/auth/github/install/?installation_id=42&setup_action=update",
  ]) {
    withDocument(initial, (browser) => {
      captureCallbackInput();
      // One write, in place: the router starts on the connect situation, and
      // Back does not return to a landing with nothing left to finish.
      assert.equal(
        browser.address(),
        "https://app.test/install?installationId=42",
      );
      assert.equal(browser.writes(), 1);
      assert.equal(browser.referrer(), "no-referrer");
      assert.equal(takeCallbackInput("github-install").toString(), "");
    });
  }
});

test("a setup return with a state or a request stays on the landing", () => {
  for (const query of [
    "installation_id=42&state=abc",
    "installation_id=42&setup_action=request",
    "setup_action=request",
    "installation_id=abc",
  ]) {
    withDocument(`https://app.test/auth/github/install?${query}`, (browser) => {
      captureCallbackInput();
      assert.equal(browser.address(), "https://app.test/auth/github/install");
      assert.equal(browser.writes(), 1);
      assert.equal(takeCallbackInput("github-install").toString(), query);
    });
  }
});

test("a landing opened without input still takes nothing", () => {
  withDocument("https://app.test/auth/github/callback", (browser) => {
    captureCallbackInput();
    assert.equal(browser.writes(), 1);
    assert.equal(browser.referrer(), "no-referrer");
    assert.equal(takeCallbackInput("github-callback").toString(), "");
  });
});

test("every other address is left exactly as it loaded", () => {
  for (const initial of [
    "https://app.test/sign-in?returnTo=%2Fdashboard#token=kept",
    "https://app.test/auth/email?code=kept",
    "https://app.test/app/auth/email/callback#token=old-prefix",
  ]) {
    withDocument(initial, (browser) => {
      captureCallbackInput();
      assert.equal(browser.address(), initial);
      assert.equal(browser.writes(), 0);
      assert.equal(browser.referrer(), undefined);
      assert.equal(takeCallbackInput("email").toString(), "");
    });
  }
});

test("a native runtime captures nothing", () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, "window");
  // Expo gives a native `window` the app's origin as its location, or none,
  // and never a history to write to.
  for (const location of [
    undefined,
    { pathname: "/", search: "", hash: "" },
    { pathname: "/auth/email/callback", search: "", hash: "#token=one" },
  ]) {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location },
    });
    try {
      assert.doesNotThrow(captureCallbackInput);
      assert.equal(takeCallbackInput("email").toString(), "");
    } finally {
      if (saved) Object.defineProperty(globalThis, "window", saved);
      else Reflect.deleteProperty(globalThis, "window");
    }
  }
});
