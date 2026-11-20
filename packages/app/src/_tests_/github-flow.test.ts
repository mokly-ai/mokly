import assert from "node:assert/strict";
import { test } from "node:test";

import {
  consumeGitHubCallback,
  consumeGitHubInstallation,
  githubFlowKeys,
  statelessInstallation,
  storeGitHubFlow,
} from "../navigation/github-flow";

const state = "a".repeat(64);
const verifier = "b".repeat(64);

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

/**
 * Run with a tab whose session storage this test holds. The provider input is
 * handed over as the landing captured it, so the address is not part of this.
 */
function withBrowser(run: (storage: Storage) => void): void {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { sessionStorage: storage } as unknown as Window & typeof globalThis,
  });
  try {
    run(storage);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

test("GitHub flow helpers refuse a non-browser runtime", () => {
  assert.equal(
    storeGitHubFlow("sign-in", {
      authorizeUrl: "https://github.test/authorize",
      state,
      codeVerifier: verifier,
    }),
    false,
  );
  assert.deepEqual(
    consumeGitHubCallback(new URLSearchParams(`code=one&state=${state}`)),
    { status: "invalid" },
  );
  assert.deepEqual(
    consumeGitHubInstallation(
      new URLSearchParams(`installation_id=42&state=${state}`),
    ),
    { status: "invalid" },
  );
});

test("a callback consumes one matching purpose, once", () => {
  withBrowser((storage) => {
    storage.setItem(githubFlowKeys.connect, "stale");
    assert.equal(
      storeGitHubFlow("sign-in", {
        authorizeUrl: "https://github.test/authorize",
        state,
        codeVerifier: verifier,
      }),
      true,
    );
    assert.equal(storage.getItem(githubFlowKeys.connect), null);
    const input = `code=provider-code&state=${state}`;
    assert.deepEqual(consumeGitHubCallback(new URLSearchParams(input)), {
      status: "valid",
      purpose: "sign-in",
      code: "provider-code",
      state,
      codeVerifier: verifier,
    });
    assert.equal(storage.getItem(githubFlowKeys["sign-in"]), null);
    assert.deepEqual(consumeGitHubCallback(new URLSearchParams(input)), {
      status: "invalid",
    });
  });
});

test("duplicate callback values are refused without retaining a verifier", () => {
  withBrowser((storage) => {
    storage.setItem(
      githubFlowKeys["sign-in"],
      JSON.stringify({ state, codeVerifier: verifier }),
    );
    assert.deepEqual(
      consumeGitHubCallback(
        new URLSearchParams(`code=one&state=${state}&state=${state}`),
      ),
      { status: "invalid" },
    );
    assert.equal(storage.getItem(githubFlowKeys["sign-in"]), null);
  });
});

test("a provider refusal preserves the matching callback purpose", () => {
  withBrowser((storage) => {
    storage.setItem(
      githubFlowKeys.connect,
      JSON.stringify({ state, codeVerifier: verifier }),
    );
    assert.deepEqual(
      consumeGitHubCallback(
        new URLSearchParams(`error=access_denied&state=${state}`),
      ),
      { status: "refused", purpose: "connect" },
    );
    assert.equal(storage.getItem(githubFlowKeys.connect), null);
  });
});

test("a callback with no captured input is refused and clears the tab", () => {
  withBrowser((storage) => {
    storage.setItem(
      githubFlowKeys["sign-in"],
      JSON.stringify({ state, codeVerifier: verifier }),
    );
    assert.deepEqual(consumeGitHubCallback(new URLSearchParams()), {
      status: "invalid",
    });
    assert.equal(storage.getItem(githubFlowKeys["sign-in"]), null);
  });
});

test("installation setup accepts only a safe positive provider identifier", () => {
  withBrowser((storage) => {
    storage.setItem(
      githubFlowKeys["install-setup"],
      JSON.stringify({ state, codeVerifier: verifier }),
    );
    const input = `installation_id=42&state=${state}&setup_action=install`;
    assert.deepEqual(consumeGitHubInstallation(new URLSearchParams(input)), {
      status: "valid",
      installationId: 42,
      state,
      codeVerifier: verifier,
    });
    assert.equal(storage.getItem(githubFlowKeys["install-setup"]), null);
    assert.deepEqual(consumeGitHubInstallation(new URLSearchParams(input)), {
      status: "invalid",
    });
  });
  withBrowser((storage) => {
    storage.setItem(
      githubFlowKeys["install-setup"],
      JSON.stringify({ state, codeVerifier: verifier }),
    );
    assert.deepEqual(
      consumeGitHubInstallation(
        new URLSearchParams(`installation_id=9007199254740992&state=${state}`),
      ),
      { status: "invalid" },
    );
    assert.equal(storage.getItem(githubFlowKeys["install-setup"]), null);
  });
});

test("a request waiting for approval ends the setup trip and sends nothing", () => {
  withBrowser((storage) => {
    storage.setItem(
      githubFlowKeys["install-setup"],
      JSON.stringify({ state, codeVerifier: verifier }),
    );
    // GitHub may name an installation or a state beside the request; neither
    // makes it a setup the API can finish.
    for (const input of [
      "setup_action=request",
      `setup_action=request&state=${state}`,
      `installation_id=42&state=${state}&setup_action=request`,
    ]) {
      assert.deepEqual(consumeGitHubInstallation(new URLSearchParams(input)), {
        status: "requested",
      });
      assert.equal(storage.getItem(githubFlowKeys["install-setup"]), null);
    }
  });
  // Without a tab store the request is still drawn: it reads nothing there.
  assert.deepEqual(
    consumeGitHubInstallation(new URLSearchParams("setup_action=request")),
    { status: "requested" },
  );
});

test("a stateless setup return names its installation and nothing else does", () => {
  assert.equal(
    statelessInstallation(new URLSearchParams("installation_id=42")),
    42,
  );
  assert.equal(
    statelessInstallation(
      new URLSearchParams("installation_id=42&setup_action=update"),
    ),
    42,
  );
  for (const input of [
    `installation_id=42&state=${state}`,
    "installation_id=42&state=",
    "installation_id=42&setup_action=request",
    "installation_id=42&installation_id=43",
    "installation_id=0",
    "installation_id=042",
    "installation_id=abc",
    "installation_id=9007199254740992",
    "setup_action=update",
    "",
  ]) {
    assert.equal(
      statelessInstallation(new URLSearchParams(input)),
      undefined,
      input,
    );
  }
});
