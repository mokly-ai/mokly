import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { accessWorkerPath } from "../src/access/paths.js";
import { tokenStorageFailed, tokenStored } from "../src/access/worker_ack.js";

const host = "https://app.test";
const origin = "https://frames.test";
const token =
  '{ "channel": "mokly-frame-access", "version": 1, "type": "token", "token": "secret", "expiresAt": 8 }';
const html = await fs.readFile(
  new URL("../dist/browser/access-start.html", import.meta.url),
  "utf8",
);

function startPage({
  query = `?mokly-host=${encodeURIComponent(host)}`,
  status = 401,
  controlled = false,
  registrationFails = false,
  handOffFails = false,
} = {}) {
  const requests: { href: string; init: RequestInit }[] = [];
  const registrations: { path: string; init: RegistrationOptions }[] = [];
  const handOff: string[] = [];
  const reports: { data: string; origin: string }[] = [];
  const steps: string[] = [];
  const document = { readyState: "loading" };
  let waitingForLoad: () => void;
  let registered: () => void;
  let reported: () => void;
  let posted: () => void;
  const loadListener = new Promise<void>((resolve) => {
    waitingForLoad = resolve;
  });
  const registration = new Promise<void>((resolve) => {
    registered = resolve;
  });
  const outcome = new Promise<void>((resolve) => {
    reported = resolve;
  });
  const postedToken = new Promise<void>((resolve) => {
    posted = resolve;
  });
  const parent = {
    postMessage(data: string, origin: string) {
      reports.push({ data, origin });
      if (reports.length > 1) reported();
      steps.push(JSON.parse(data).type);
    },
  };
  const worker = Object.assign(new EventTarget(), {
    scriptURL: origin + accessWorkerPath,
    state: "installing",
    postMessage(message: string) {
      if (handOffFails) throw new Error("Worker stopped");
      handOff.push(message);
      posted();
    },
  });
  const serviceWorker = Object.assign(new EventTarget(), {
    controller: controlled ? worker : null,
    async register(path: string, init: RegistrationOptions) {
      registrations.push({ path, init: structuredClone(init) });
      registered();
      if (registrationFails) throw new Error("Registration refused");
      return { installing: worker, active: null, waiting: null };
    },
  });
  const location = Object.assign(
    new URL(`${origin}/static/screen.html${query}`),
    {
      reload() {
        steps.push("location.reload");
      },
    },
  );
  const events = new EventTarget();
  const window = {
    location,
    parent,
    navigator: { serviceWorker },
    addEventListener(
      type: string,
      listener: EventListener,
      options?: AddEventListenerOptions,
    ) {
      events.addEventListener(type, listener, options);
      if (type === "load") waitingForLoad();
    },
    removeEventListener: events.removeEventListener.bind(events),
  };
  const inline = /<script>([\s\S]+)<\/script>/u.exec(html)?.[1];
  assert.ok(inline);
  vm.runInNewContext(inline, {
    window,
    document,
    URL,
    TextEncoder,
    async fetch(href: string, init: RequestInit) {
      requests.push({ href, init: structuredClone(init) });
      return new Response(null, { status });
    },
  });
  return {
    requests,
    reports,
    steps,
    registration,
    registrations,
    handOff,
    loadListener,
    outcome,
    postedToken,
    href: location.href,
    send(
      data: unknown,
      origin = host,
      source: unknown = parent,
      ports: unknown[] = [],
    ) {
      events.dispatchEvent(
        Object.assign(new Event("message"), { data, origin, source, ports }),
      );
    },
    state(state: string) {
      worker.state = state;
      worker.dispatchEvent(new Event("statechange"));
    },
    ack(data: string, fromWorker = true) {
      serviceWorker.dispatchEvent(
        Object.assign(new Event("message"), {
          data,
          source: fromWorker ? worker : {},
          ports: [],
        }),
      );
    },
    load() {
      document.readyState = "complete";
      events.dispatchEvent(new Event("load"));
    },
  };
}

test("the start document has only its inline script and stays inert without one foreign host", () => {
  assert.match(
    html,
    /^<!doctype html><html><head><meta charset="utf-8"><\/head><body><script>[^]*<\/script><\/body><\/html>\s*$/u,
  );
  assert.equal(html.match(/<script[ >]/gu)?.length, 1);
  for (const query of [
    "",
    "?mokly-host=null",
    "?mokly-host=https://frames.test",
    "?mokly-host=https://app.test&mokly-host=https://app.test",
  ]) {
    const page = startPage({ query });
    page.send(token);
    assert.deepEqual(page.reports, [], query);
    assert.deepEqual(page.requests, [], query);
  }
});

test("the start page trusts one parent token and reloads after load when cookies work", async () => {
  const page = startPage({ status: 200 });
  page.send(token, "https://wrong.test");
  page.send(token, host, {});
  page.send(token, host, undefined, [{}]);
  page.send(token.replace("secret", "two words"));
  assert.deepEqual(page.requests, []);
  page.send(token);
  page.send(token);
  await page.loadListener;
  assert.deepEqual(page.requests, [
    {
      href: page.href,
      init: {
        mode: "same-origin",
        credentials: "same-origin",
        cache: "no-store",
      },
    },
  ]);
  assert.deepEqual(page.registrations, []);
  assert.deepEqual(page.steps, ["request"]);
  page.load();
  await page.outcome;
  assert.deepEqual(page.steps, ["request", "reload", "location.reload"]);
  assert.deepEqual(
    page.reports.map(({ origin }) => origin),
    [host, host],
  );
});

test("the start page waits for the active worker to confirm storage before reloading", async () => {
  const page = startPage({ controlled: true });
  page.load();
  page.send(token);
  await page.registration;
  assert.deepEqual(page.requests[0]?.init.headers, { Authorization: "" });
  assert.deepEqual(page.registrations, [
    { path: accessWorkerPath, init: { scope: "/" } },
  ]);
  assert.deepEqual(page.handOff, []);
  page.state("activated");
  await page.postedToken;
  assert.deepEqual(page.handOff, [token]);
  page.ack(tokenStored, false);
  assert.deepEqual(page.steps, ["request"]);
  page.ack(tokenStored);
  await page.outcome;
  assert.deepEqual(page.steps, ["request", "reload", "location.reload"]);
});

test("the start page reports registration, hand-off and storage failures", async () => {
  for (const options of [
    { registrationFails: true },
    { handOffFails: true },
    {},
  ]) {
    const page = startPage(options);
    page.send(token);
    await page.registration;
    page.state("activated");
    if (!options.registrationFails && !options.handOffFails) {
      await page.postedToken;
      page.ack(tokenStorageFailed);
    }
    await page.outcome;
    assert.deepEqual(page.steps, ["request", "unavailable"]);
  }
});
