import { createHash } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { TestContext } from "node:test";

/** One registry request, with its raw token and whether it is the expected one. */
export type RegistryRequest = {
  path: string;
  authorized: boolean;
  authorization: string | null;
};

/**
 * A local npm registry for one package. It serves the packument and the
 * tarballs only to requests with the bearer token, and records every request.
 */
export async function localRegistry(
  context: TestContext,
  name: string,
  versions: ReadonlyArray<{ version: string; tarball: Buffer }>,
  token: string,
) {
  const requests: RegistryRequest[] = [];
  let url = "";
  const tarballs = new Map(
    versions.map(({ version, tarball }) => [
      `/${name}/-/${name}-${version}.tgz`,
      tarball,
    ]),
  );
  const server = http.createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const authorization = request.headers.authorization ?? null;
    const authorized = authorization === `Bearer ${token}`;
    requests.push({ path, authorized, authorization });
    const tarball = tarballs.get(path);
    if (!authorized) {
      response.writeHead(401).end();
    } else if (tarball) {
      response
        .writeHead(200, { "content-type": "application/octet-stream" })
        .end(tarball);
    } else if (decodeURIComponent(path) === `/${name}`) {
      response
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify(packument(url, name, versions)));
    } else {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(
    () => new Promise<void>((resolve) => server.close(() => resolve())),
  );
  const { port } = server.address() as AddressInfo;
  url = `http://127.0.0.1:${port}`;
  return { url, port, requests };
}

function packument(
  url: string,
  name: string,
  versions: ReadonlyArray<{ version: string; tarball: Buffer }>,
) {
  const published = "2020-01-01T00:00:00.000Z";
  return {
    name,
    "dist-tags": { latest: versions.at(-1)?.version },
    // Old release times keep the versions outside any minimum-age quarantine.
    time: {
      created: published,
      modified: published,
      ...Object.fromEntries(
        versions.map(({ version }) => [version, published]),
      ),
    },
    versions: Object.fromEntries(
      versions.map(({ version, tarball }) => [
        version,
        {
          name,
          version,
          main: "index.js",
          dist: {
            tarball: `${url}/${name}/-/${name}-${version}.tgz`,
            shasum: createHash("sha1").update(tarball).digest("hex"),
            integrity: `sha512-${createHash("sha512").update(tarball).digest("base64")}`,
          },
        },
      ]),
    ),
  };
}
