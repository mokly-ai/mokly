import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import zlib from "node:zlib";

interface MarkerEntry {
  path: string;
  sha256: string;
  size: number;
}

function archive(bytes: Buffer): Map<string, Buffer> {
  const tar = zlib.gunzipSync(bytes);
  const files = new Map<string, Buffer>();
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    const name = header.subarray(0, 100).toString().replace(/\0.*$/su, "");
    if (!name) break;
    const size = Number.parseInt(
      header.subarray(124, 136).toString().replace(/\0.*$/su, "").trim(),
      8,
    );
    assert.equal(header[156], 48);
    files.set(name, tar.subarray(offset + 512, offset + 512 + size));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

export async function exchange(
  options: { retry?: boolean; holdPlan?: () => void } = {},
) {
  const bodies: Buffer[] = [];
  const blobs = new Map<string, Buffer>();
  const attempts = new Map<string, number>();
  let entries: MarkerEntry[] = [];
  let complete = 0;
  let base = "";
  let failure: unknown;
  const server = http.createServer(async (request, response) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const bytes = Buffer.concat(chunks);
      assert.equal(request.headers.authorization, "Bearer private/a==");
      if (request.url === "/plan?key=1=2") {
        bodies.push(bytes);
        const files = archive(bytes);
        assert.deepEqual(
          [...files.keys()],
          ["mokly-upload.json", ".mokly-export-artifact"],
        );
        const marker = JSON.parse(
          files.get(".mokly-export-artifact")!.toString(),
        ) as { files: MarkerEntry[] };
        entries = marker.files;
        for (const entry of entries) {
          const bytes = files.get(entry.path);
          if (bytes) blobs.set(entry.sha256, bytes);
        }
        if (options.holdPlan) {
          options.holdPlan();
          return;
        }
        if (options.retry && bodies.length === 1) {
          response.writeHead(503, { "Retry-After": "0" }).end();
          return;
        }
        response.writeHead(200, { "Content-Type": "application/json" }).end(
          JSON.stringify({
            schemaVersion: 1,
            upload: { id: "local", expiresAt: "2099-01-01T00:00:00.000Z" },
            missing: [
              ...new Set(
                entries
                  .map((entry) => entry.sha256)
                  .filter((hash) => !blobs.has(hash)),
              ),
            ].sort(),
            blobUrl: `${base}/blobs/{sha256}`,
            completeUrl: `${base}/complete`,
          }),
        );
      } else if (request.url?.startsWith("/blobs/")) {
        const hash = request.url.slice("/blobs/".length);
        assert.equal(
          crypto.createHash("sha256").update(bytes).digest("hex"),
          hash,
        );
        attempts.set(hash, (attempts.get(hash) ?? 0) + 1);
        if (options.retry && attempts.get(hash) === 1) {
          response.writeHead(503, { "Retry-After": "0" }).end();
          return;
        }
        blobs.set(hash, bytes);
        response.writeHead(204).end();
      } else {
        assert.equal(request.url, "/complete");
        for (const entry of entries) {
          assert.equal(blobs.get(entry.sha256)?.length, entry.size);
        }
        complete++;
        response
          .writeHead(complete === 1 ? 201 : 200, {
            "Content-Type": "application/json",
          })
          .end(JSON.stringify({ viewerUrl: `${base}/catalogue` }));
      }
    } catch (error) {
      failure = error;
      response.writeHead(500).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  base = `http://127.0.0.1:${address.port}`;
  return {
    endpoint: `${base}/plan?key=1=2`,
    bodies,
    attempts,
    get completed() {
      return complete;
    },
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      if (failure) throw failure;
    },
  };
}
