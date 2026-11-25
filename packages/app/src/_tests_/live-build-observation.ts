import type { Page } from "@playwright/test";

import { liveProjectUrl } from "../data/live-client";

import { apiOrigin } from "./origins";

type BuildRead = "getBuild" | "listBuildLog";

interface BuildObservation {
  open: boolean;
  pending: number;
  reads: BuildRead[];
}

declare global {
  interface Window {
    observeBuildReads?: () => BuildObservation;
  }
}

/** Observe one build's real reads and socket from the fresh card's document. */
export async function observeLiveBuild(
  page: Page,
  projectId: string,
  buildId: string,
) {
  const buildUrl = `${apiOrigin}/v1/projects/${projectId}/builds/${buildId}`;
  const socketUrl = liveProjectUrl(apiOrigin, projectId).href;
  await page.addInitScript(installObserver, { buildUrl, socketUrl });

  const connection = await page.context().newCDPSession(page);
  const sockets = new Set<string>();
  let status: number | undefined;
  connection.on("Network.webSocketCreated", ({ requestId, url }) => {
    if (url === socketUrl) sockets.add(requestId);
  });
  connection.on("Network.webSocketHandshakeResponseReceived", (event) => {
    if (sockets.has(event.requestId)) status = event.response.status;
  });
  await connection.send("Network.enable");

  return {
    handshake: () => status,
    snapshot: () =>
      page.evaluate(() => {
        if (!window.observeBuildReads)
          throw new Error("The build read observer was not installed");
        return window.observeBuildReads();
      }),
  };
}

function installObserver({
  buildUrl,
  socketUrl,
}: {
  buildUrl: string;
  socketUrl: string;
}) {
  const reads: BuildRead[] = [];
  let pending = 0;
  let socketOpen = () => false;
  const NativeWebSocket = window.WebSocket;
  const nativeFetch = window.fetch.bind(window);

  window.WebSocket = class extends NativeWebSocket {
    constructor(...args: ConstructorParameters<typeof WebSocket>) {
      super(...args);
      if (this.url === socketUrl)
        socketOpen = () => this.readyState === NativeWebSocket.OPEN;
    }
  };

  // The initial log read can start a refresh queued by the socket's open.
  // Let the card consume the JSON and start that read before reporting idle.
  function settled() {
    const task = new MessageChannel();
    task.port1.onmessage = () => {
      pending -= 1;
      task.port1.close();
      task.port2.close();
    };
    task.port2.postMessage(null);
  }

  window.fetch = async (input, init) => {
    if (!(input instanceof Request) || input.method !== "GET")
      return nativeFetch(input, init);
    const url = new URL(input.url);
    const endpoint = url.origin + url.pathname;
    if (endpoint === buildUrl) reads.push("getBuild");
    else if (endpoint === buildUrl + "/log") reads.push("listBuildLog");
    else return nativeFetch(input, init);

    pending += 1;
    try {
      const response = await nativeFetch(input, init);
      const json = response.json.bind(response);
      response.json = () => json().finally(settled);
      return response;
    } catch (error) {
      settled();
      throw error;
    }
  };

  window.observeBuildReads = () => ({
    open: socketOpen(),
    pending,
    reads,
  });
}
