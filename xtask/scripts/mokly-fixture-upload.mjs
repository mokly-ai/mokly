// Loopback Plan receiver shared by real publish captures and failure probes.
import assert from "node:assert/strict";
import { createServer } from "node:http";

export const testToken = `mkp_${"0".repeat(64)}`;
const planPath =
  "/v1/projects/00000000-0000-0000-0000-000000000001/publications";

export async function planReceiver(status) {
  const requests = [];
  const server = createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      requests.push({
        method: request.method,
        url: request.url,
        authorization: request.headers.authorization,
        contentType: request.headers["content-type"],
        body: Buffer.concat(chunks),
      });
      response.writeHead(status, status === 503 ? { "Retry-After": "0" } : {});
      response.end();
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const endpoint = `http://127.0.0.1:${server.address().port}${planPath}`;
  return {
    endpoint,
    requests,
    verify(count) {
      assert.equal(requests.length, count, `Expected ${count} Plan requests`);
      for (const request of requests) {
        assert.equal(request.method, "POST");
        assert.equal(request.url, planPath);
        assert.equal(request.authorization, `Bearer ${testToken}`);
        assert.equal(request.contentType, "application/gzip");
      }
    },
    async close() {
      server.closeAllConnections();
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

export function failureCode(result) {
  assert(
    Number.isInteger(result.exitCode) && result.exitCode !== 0,
    `Expected a normal CLI failure: ${result.stderr}`,
  );
  const matches = [...result.stderr.matchAll(/^\[mokly\/([a-z0-9-]+)\] /gm)];
  assert.equal(
    matches.length,
    1,
    `Expected one plain CLI failure: ${result.stderr}`,
  );
  return matches[0][1];
}
