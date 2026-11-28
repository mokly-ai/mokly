import { hostOrigin } from "../probe/values.js";

import { decodeAccessMessage, encodeAccessMessage } from "./channel.js";
import { accessWorkerPath, isAccessWorker } from "./paths.js";
import { tokenStorageFailed, tokenStored } from "./worker_ack.js";

function handOff(
  container: ServiceWorkerContainer,
  worker: ServiceWorker,
  tokenMessage: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    let posted = false;
    function finish(stored: boolean) {
      worker.removeEventListener("statechange", stateChanged);
      container.removeEventListener("message", receive);
      resolve(stored);
    }
    function stateChanged() {
      if (worker.state === "redundant") return finish(false);
      if (worker.state !== "activated" || posted) return;
      posted = true;
      try {
        worker.postMessage(tokenMessage);
      } catch {
        finish(false);
      }
    }
    function receive(event: MessageEvent<unknown>) {
      if (event.source !== worker || event.ports.length) return;
      if (event.data === tokenStored) finish(true);
      if (event.data === tokenStorageFailed) finish(false);
    }
    worker.addEventListener("statechange", stateChanged);
    container.addEventListener("message", receive);
    stateChanged();
  });
}

async function hasCookie(): Promise<boolean> {
  try {
    const { origin, href } = window.location;
    const controller = window.navigator.serviceWorker?.controller;
    const response = await fetch(href, {
      mode: "same-origin",
      credentials: "same-origin",
      cache: "no-store",
      // An existing access worker preserves this empty header, so only a cookie can authenticate the check.
      ...(isAccessWorker(controller, origin)
        ? { headers: { Authorization: "" } }
        : {}),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function giveTokenToWorker(message: string): Promise<boolean> {
  try {
    const container = window.navigator.serviceWorker;
    const registration = await container.register(accessWorkerPath, {
      scope: "/",
    });
    const worker =
      registration.installing ?? registration.waiting ?? registration.active;
    return worker ? await handOff(container, worker, message) : false;
  } catch {
    return false;
  }
}

function start(host: string) {
  const parent = window.parent;
  const send = (type: "request" | "reload" | "unavailable") =>
    parent.postMessage(encodeAccessMessage({ type }), host);
  async function reload(message: string) {
    if (!(await hasCookie()) && !(await giveTokenToWorker(message))) {
      send("unavailable");
      return;
    }
    if (document.readyState !== "complete")
      await new Promise<void>((resolve) =>
        window.addEventListener("load", () => resolve(), { once: true }),
      );
    send("reload");
    window.location.reload();
  }
  function receive(event: MessageEvent<unknown>) {
    if (
      event.source !== parent ||
      event.origin !== host ||
      event.ports.length ||
      typeof event.data !== "string" ||
      decodeAccessMessage(event.data)?.type !== "token"
    )
      return;
    window.removeEventListener("message", receive);
    void reload(event.data);
  }
  window.addEventListener("message", receive);
  send("request");
}

const host = hostOrigin(window.location);
if (host) start(host);
