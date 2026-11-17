import assert from "node:assert/strict";
import test from "node:test";
import { safeDiagnostic } from "../diagnostics.js";
import { navigationError } from "./navigation-error.js";
import { createHandoff, exchangeObserver, handoffToken } from "../handoff.js";
import { deferred, settled } from "./lifecycle-fixture.js";

const token = "a".repeat(64);
const address = `mokly://auth/email/callback#token=${token}`;
test("the scheme validator accepts only the canonical credential form", () => {
  assert.equal(handoffToken(address), token);
  for (const invalid of [
    address + "&extra=1",
    address + "&token=" + token,
    address + "&",
    address.replace("#", "?"),
    address.replace("callback#", "callback?client=desktop#"),
    address.replace("auth/", "other/"),
    address.replace("mokly:", "https:"),
    address.replace("mokly:", "MOKLY:"),
    address.replace("callback#", "callback/#"),
    address.replace("auth/", "auth:80/"),
    address.replace("auth/", "user@auth/"),
    address.replace(token, token.toUpperCase()),
    address.replace(token, token.slice(1)),
    address.replace(token, token + "0"),
    address.replace("token", "%74oken"),
    address + "\n",
    " " + address,
  ])
    assert.equal(handoffToken(invalid), undefined, invalid.slice(0, 55));
});

test("a repeated handoff never reloads the landing or interrupts its exchange", async () => {
  const loaded: string[] = [];
  let focused = 0;
  const handoff = createHandoff({
    window: () => ({
      load: async (url) => {
        loaded.push(url);
        handoff.navigated(url);
      },
      focus: () => {
        focused++;
      },
    }),
    warn: assert.fail,
  });
  assert.equal(handoff.receive(address), true);
  assert.equal(handoff.receive(address), false);
  handoff.navigated("mokly-app://desktop/auth/email/callback");
  const next = address.replace(token, "b".repeat(64));
  assert.equal(handoff.receive(next), false);
  await settled();
  assert.equal(loaded.length, 2);
  handoff.navigated("mokly-app://desktop/auth/email/callback");
  handoff.started(1);
  handoff.settled(1);
  assert.equal(handoff.receive(address), false);
  assert.equal(handoff.receive(next), true);
  await settled();
  handoff.navigated("mokly-app://desktop/new");
  assert.equal(handoff.receive(address.replace(token, "c".repeat(64))), true);
  assert.equal(focused, 3);
  assert.equal(
    loaded[1],
    `mokly-app://desktop/auth/email/callback#token=${token}`,
  );
});

test("a preflight completion does not release an active landing exchange", () => {
  let settlements = 0;
  const requestIds: number[] = [];
  const observe = exchangeObserver((id) => {
    settlements++;
    requestIds.push(id);
  });
  observe({ method: "OPTIONS", id: 1 });
  assert.equal(settlements, 0);
  observe({ method: "POST", id: 2 });
  assert.equal(settlements, 1);
  assert.deepEqual(requestIds, [2]);
});

test("a failed handoff warns without logging its one-use credential", async () => {
  const warnings: string[] = [];
  const handoff = createHandoff({
    window: () => ({
      focus: () => {},
      load: async (url) => {
        if (url === "about:blank") return;
        throw navigationError(url);
      },
    }),
    warn: (error) => {
      warnings.push(safeDiagnostic(error));
    },
  });
  assert.equal(handoff.receive(address), true);
  await settled();
  assert.equal(warnings.length, 1);
  assert.equal(
    warnings.some((line) => line.includes(token)),
    false,
  );
  assert.equal(warnings[0], "Desktop operation failed (ERR_ABORTED)");
});

test("a failed landing accepts a fresh document for the next token and guards its exchange", async () => {
  const captured: string[] = [];
  let current = "mokly-app://desktop/dashboard";
  let requestId = 0;
  const handoff = createHandoff({
    window: () => ({
      focus: () => {},
      load: async (url) => {
        const previous = new URL(current);
        previous.hash = "";
        const destination = new URL(url);
        const next = new URL(url);
        next.hash = "";
        current = url;
        if (url !== "about:blank")
          handoff.navigated("mokly-app://desktop/dashboard");
        handoff.navigated(url);
        if (url === "about:blank") {
          // Reset navigation and an old request's failure cannot admit another token.
          handoff.settled(requestId);
          return;
        }
        if (next.href !== previous.href) {
          const received = new URLSearchParams(destination.hash.slice(1)).get(
            "token",
          );
          assert.equal(destination.pathname, "/auth/email/callback");
          assert.equal(destination.search, "");
          assert.ok(received);
          captured.push(received);
          current = next.href;
          handoff.navigated(current);
          handoff.started(++requestId);
        }
      },
    }),
    warn: assert.fail,
  });
  assert.equal(handoff.receive(address), true);
  await settled();
  assert.deepEqual(captured, [token]);
  handoff.settled(1); // The API has refused the first token; the landing stays mounted.

  const second = "b".repeat(64);
  const third = address.replace(token, "c".repeat(64));
  assert.equal(handoff.receive(address.replace(token, second)), true);
  assert.equal(handoff.receive(third), false);
  await settled();
  assert.deepEqual(captured, [token, second]);
  assert.equal(handoff.receive(address), false);
  assert.equal(handoff.receive(address.replace(token, second)), false);
  handoff.navigated("about:blank");
  handoff.settled(1); // The old request cannot finish the second exchange.
  assert.equal(handoff.receive(third), false);
  handoff.settled(2);
  assert.equal(handoff.receive(third), true);
  await settled();
  assert.deepEqual(captured, [token, second, "c".repeat(64)]);
});

test("a late load failure cannot release a newer handoff's guard", async () => {
  const first = deferred();
  const warnings: unknown[] = [];
  const handoff = createHandoff({
    window: () => ({
      focus: () => {},
      load: (url) => {
        handoff.navigated(url);
        if (url.includes("#token="))
          handoff.started(url.endsWith(token) ? 1 : 2);
        return url.endsWith(token) ? first.promise : Promise.resolve();
      },
    }),
    warn: (error) => warnings.push(error),
  });
  assert.equal(handoff.receive(address), true);
  await settled();
  handoff.settled(1);
  assert.equal(handoff.receive(address.replace(token, "b".repeat(64))), true);
  first.reject(navigationError(address));
  await settled();
  assert.equal(warnings.length, 1);
  assert.equal(handoff.receive(address.replace(token, "c".repeat(64))), false);
});

test("a failed document reset releases the guard without retrying a received token", async () => {
  const warnings: unknown[] = [];
  let resets = 0;
  const handoff = createHandoff({
    window: () => ({
      focus: () => {},
      load: async (url) => {
        if (url === "about:blank" && resets++ === 0) throw navigationError(url);
        handoff.navigated(url);
      },
    }),
    warn: (error) => warnings.push(error),
  });
  assert.equal(handoff.receive(address), true);
  await settled();
  assert.equal(warnings.length, 1);
  assert.equal(handoff.receive(address), false);
  assert.equal(handoff.receive(address.replace(token, "b".repeat(64))), true);
  await settled();
  assert.equal(handoff.receive(address.replace(token, "c".repeat(64))), false);
});
