/// <reference lib="webworker" />

import { decodeAccessMessage } from "./channel.js";
import { accessStartPath } from "./paths.js";
import { deleteTokenIfCurrent, readToken, storeToken } from "./token_store.js";
import { tokenStorageFailed, tokenStored } from "./worker_ack.js";

declare const self: ServiceWorkerGlobalScope;

const origin = self.location.origin;

async function fetchOwn(request: Request): Promise<Response> {
  let outgoing = request;
  const token = request.headers.has("Authorization")
    ? undefined
    : await readToken().catch(() => undefined);
  if (token) {
    const headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${token.token}`);
    // A no-cors header guard strips Authorization, and Request init cannot set navigate.
    const mode =
      request.mode === "no-cors" || request.mode === "navigate"
        ? "same-origin"
        : request.mode;
    outgoing = new Request(request, { headers, mode });
  }
  const response = await fetch(outgoing);
  if (request.mode !== "navigate" || response.status !== 401) return response;
  if (token) await deleteTokenIfCurrent(token.token).catch(() => undefined);
  return fetch(new URL(accessStartPath, origin), {
    mode: "same-origin",
    credentials: "same-origin",
    cache: "no-store",
  });
}

self.addEventListener("install", (event) =>
  event.waitUntil(self.skipWaiting()),
);
self.addEventListener("message", (event) => {
  const client = event.source;
  if (
    !client ||
    !("type" in client) ||
    client.type !== "window" ||
    new URL(client.url).origin !== origin ||
    event.ports.length
  )
    return;
  const message = decodeAccessMessage(event.data);
  if (message?.type !== "token") return;
  event.waitUntil(
    storeToken(message).then(
      () => client.postMessage(tokenStored),
      () => client.postMessage(tokenStorageFailed),
    ),
  );
});
self.addEventListener("fetch", (event) => {
  if (new URL(event.request.url).origin === origin)
    event.respondWith(fetchOwn(event.request));
});
