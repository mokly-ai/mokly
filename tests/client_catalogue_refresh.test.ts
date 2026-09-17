import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { refreshBrowseEvidence } from "../dist/client/browse_refresh.js";

/** Abort during JSON parsing must not adopt a public snapshot or private evidence. */
test("live refresh fences a catalogue response that finishes after cancellation", async () => {
  const controller = new AbortController();
  const attrs = new Map([
    ["data-mokly-content-version", "1"],
    ["data-mokly-update-version", "2"],
  ]);
  const events: Event[] = [];
  const child = {};
  const doc = {
    documentElement: {
      getAttribute: (name: string) => attrs.get(name) ?? null,
      hasAttribute: () => false,
    },
    querySelector: () => ({
      firstElementChild: child,
      getAttribute: () => null,
    }),
    dispatchEvent: (event: Event) => events.push(event),
  } as unknown as Document;
  const next = {
    ...doc,
    documentElement: {
      getAttribute: (name: string) =>
        name === "data-mokly-update-version" ? "3" : "1",
    },
  };
  const catalogue = JSON.parse(
    fs.readFileSync("docs/protocol/fixtures/catalogue-v1.json", "utf8"),
  );
  catalogue.revision = { content: 1, evidence: 3 };
  let request = 0;
  const win = {
    location: { href: "http://localhost/view/screens/home.html" },
    DOMParser: class {
      parseFromString() {
        return next;
      }
    },
    fetch: async () =>
      ++request === 1
        ? {
            ok: true,
            url: "http://localhost/view/screens/home.html",
            text: async () => "",
          }
        : {
            ok: true,
            url: "http://localhost/__mokly/catalogue.json",
            json: async () => {
              controller.abort();
              return catalogue;
            },
          },
  } as unknown as Window & typeof globalThis;
  await assert.rejects(refreshBrowseEvidence(doc, win, 3, controller.signal), {
    name: "AbortError",
  });
  assert.equal(events.length, 0);
});
