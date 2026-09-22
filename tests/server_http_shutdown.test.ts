import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import net from "node:net";
import test from "node:test";

import { closeCatalogueHttp } from "../src/server/http_shutdown.js";

for (const completeHeaders of [false, true]) {
  test(`HTTP shutdown disconnects ${completeHeaders ? "an unfinished response" : "unfinished request headers"}`, async (t) => {
    const server = http.createServer((_request, response) =>
      response.write("pending"),
    );
    t.after(() => {
      server.closeAllConnections();
      server.close();
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const connected = once(server, "connection");
    const client = net.connect(address.port, "127.0.0.1");
    client.on("error", () => {});
    client.resume();
    t.after(() => client.destroy());
    const [socket] = (await connected) as [net.Socket];
    const headersReceived = once(socket, "data");
    client.write(
      "GET /__mokly/events HTTP/1.1\r\nHost: localhost\r\n" +
        (completeHeaders ? "\r\n" : ""),
    );
    await headersReceived;
    const disconnected = once(client, "close", {
      signal: AbortSignal.timeout(2_000),
    });
    const closing = closeCatalogueHttp(server, new Set(), []);
    t.after(() => closing);

    await disconnected;
    await closing;
    assert.equal(server.listening, false);
  });
}

test("HTTP shutdown drains every service even when another rejects", async (t) => {
  const server = http.createServer();
  t.after(() => server.close());
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  let release = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  t.after(release);
  const failure = new Error("service could not close");
  let drained = false;
  const closing = closeCatalogueHttp(server, new Set(), [
    {
      async close() {
        throw failure;
      },
    },
    {
      async close() {
        await released;
        drained = true;
      },
    },
  ]);
  const rejected = assert.rejects(closing, (error) => error === failure);
  assert.equal(drained, false);
  release();
  await rejected;
  assert.equal(drained, true);
});
