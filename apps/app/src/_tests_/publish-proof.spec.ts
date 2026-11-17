import { spawnSync } from "node:child_process";
import { request } from "node:http";

import {
  test,
  expect,
  createProject,
  freshEmail,
  publicationPathFor,
  signIn,
} from "./harness";
import { apiOrigin, appOrigin, catalogueOrigin } from "./origins";
import { createToken, fixture, publicationBody, uploadBody } from "./publish";
import { fixtureDesktopOrigin } from "./desktop-fixture";
import { makePrivate } from "./visibility";

/**
 * Fetch one publication file from the local catalogue server. The request goes
 * to the server's own port and names the publication host in `Host`, so it
 * never depends on how this machine resolves `p-<id>.localhost`.
 */
async function catalogueFetch(
  url: string,
  options: RequestInit,
): Promise<Response> {
  const publication = new URL(url);
  const base = new URL(catalogueOrigin);
  const headers = new Headers(options.headers);
  headers.set("Host", publication.host);
  return new Promise((resolveResponse, reject) => {
    const call = request(
      {
        hostname: base.hostname,
        port: Number(base.port),
        method: options.method ?? "GET",
        path: publication.pathname + publication.search,
        headers: Object.fromEntries(headers.entries()),
        timeout: 30_000,
      },
      (received) => {
        const chunks: Buffer[] = [];
        received.on("data", (chunk: Buffer) => chunks.push(chunk));
        received.on("end", () => {
          const responseHeaders = new Headers();
          for (const [name, value] of Object.entries(received.headers)) {
            if (typeof value === "string") responseHeaders.set(name, value);
            if (Array.isArray(value)) {
              for (const entry of value) responseHeaders.append(name, entry);
            }
          }
          resolveResponse(
            new Response(
              received.statusCode === 204 ? null : Buffer.concat(chunks),
              {
                status: received.statusCode,
                headers: responseHeaders,
              },
            ),
          );
        });
      },
    );
    call.on("error", reject);
    call.on("timeout", () =>
      call.destroy(new Error("[app/tests] Catalogue request timed out")),
    );
    call.end(options.body ? String(options.body) : undefined);
  });
}

test("the pinned fixture publishes private bytes with isolated access", async ({
  page,
}) => {
  await signIn(page, freshEmail("publish-proof"));
  const projectId = await createProject(page, "Proof Org");
  await makePrivate(page, projectId);
  const token = await createToken(page, projectId);
  const body = publicationBody({ branch: "main" });
  const uploaded = await uploadBody(token, projectId, body);
  expect(uploaded.status).toBe(201);
  expect(uploaded.state).toBe("ready");
  const publicationId = uploaded.id;
  const catalogueUrl = uploaded.catalogueUrl;
  const appUrl = uploaded.viewerUrl;
  expect(publicationId).toMatch(/^[0-9a-f-]{36}$/);
  expect(catalogueUrl).toBe(
    `${new URL(catalogueOrigin).protocol}//p-${publicationId}.${new URL(catalogueOrigin).host}`,
  );
  const publicationPath = await publicationPathFor(
    page,
    projectId,
    publicationId,
  );
  expect(appUrl).toBe(`${appOrigin}${publicationPath}?view=changes`);

  const replayed = await uploadBody(token, projectId, body);
  expect(replayed.status).toBe(200);
  expect(replayed.id).toBe(publicationId);
  expect(replayed.viewerUrl).toBe(appUrl);
  expect(replayed.catalogueUrl).toBe(catalogueUrl);

  const publication = await page.evaluate(
    async ([origin, project, id]) => {
      const response = await fetch(
        `${origin}/v1/projects/${project}/publications/${id}`,
        { credentials: "include" },
      );
      if (!response.ok)
        throw new Error(`publication read failed: ${response.status}`);
      return response.json() as Promise<{
        state: string;
        catalogueUrl: string;
      }>;
    },
    [apiOrigin, projectId, publicationId] as const,
  );
  expect(publication.state).toBe("ready");
  expect(publication.catalogueUrl).toBe(catalogueUrl);

  const anonymous = await catalogueFetch(`${catalogueUrl}/index.html`, {
    headers: { Origin: appOrigin },
  });
  expect(anonymous.status).toBe(401);
  expect(anonymous.headers.get("cache-control")).toBe("no-store");
  expect(anonymous.headers.get("vary")).toBe("Origin, Cookie, Accept-Encoding");

  const access = await page.evaluate(
    async ([origin, project, id]) => {
      const session = await fetch(`${origin}/v1/session`, {
        credentials: "include",
      });
      const { csrfToken } = (await session.json()) as { csrfToken: string };
      const response = await fetch(
        `${origin}/v1/projects/${project}/publications/${id}/access-grants`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "x-csrf-token": csrfToken,
            "content-type": "application/json",
          },
          body: "{}",
        },
      );
      if (response.status !== 201)
        throw new Error(`grant failed: ${response.status}`);
      return response.json() as Promise<{ grant: string; exchangeUrl: string }>;
    },
    [apiOrigin, projectId, publicationId] as const,
  );
  expect(new URL(access.exchangeUrl).origin).toBe(catalogueUrl);
  const exchange = await catalogueFetch(access.exchangeUrl, {
    method: "POST",
    headers: { Origin: appOrigin, "content-type": "application/json" },
    body: JSON.stringify({ grant: access.grant }),
  });
  expect(exchange.status).toBe(204);
  expect(exchange.headers.get("cache-control")).toBe("no-store");
  expect(exchange.headers.get("vary")).toBe("Origin, Cookie, Accept-Encoding");
  expect(exchange.headers.get("access-control-allow-origin")).toBe(appOrigin);
  expect(exchange.headers.get("access-control-allow-credentials")).toBe("true");
  const setCookie = exchange.headers.get("set-cookie") ?? "";
  expect(/^__Host-mkc_catalogue=[^;]+;/.test(setCookie)).toBe(true);
  for (const attribute of [
    "Path=/",
    "Secure",
    "HttpOnly",
    "SameSite=None",
    "Max-Age=300",
  ]) {
    expect(setCookie.toLowerCase().includes(attribute.toLowerCase())).toBe(
      true,
    );
  }
  expect(/(?:^|;)\s*Domain=/i.test(setCookie)).toBe(false);
  const cookie = setCookie.split(";", 1)[0];
  const privateFile = await catalogueFetch(`${catalogueUrl}/index.html`, {
    headers: { Origin: appOrigin, Cookie: cookie },
  });
  expect(privateFile.status).toBe(200);
  const extracted = spawnSync("python3", [
    "-c",
    "import sys,tarfile; print('',end=''); sys.stdout.buffer.write(tarfile.open(sys.argv[1], 'r:gz').extractfile('index.html').read())",
    fixture,
  ]);
  expect(extracted.status).toBe(0);
  const bytes = Buffer.from(await privateFile.arrayBuffer());
  expect(bytes.equals(extracted.stdout)).toBe(true);
  expect(privateFile.headers.get("cache-control")).toBe("no-store");
  expect(privateFile.headers.get("vary")).toBe(
    "Origin, Cookie, Accept-Encoding",
  );
  expect(privateFile.headers.get("access-control-allow-origin")).toBe(
    appOrigin,
  );
  expect(privateFile.headers.get("access-control-allow-credentials")).toBe(
    "true",
  );
  expect(privateFile.headers.get("set-cookie")).toBeNull();
  expect(privateFile.headers.get("x-content-type-options")).toBe("nosniff");
  expect(privateFile.headers.get("referrer-policy")).toBe("no-referrer");
  expect(privateFile.headers.get("content-security-policy")).toBe(
    `default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; media-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self' ${appOrigin} ${fixtureDesktopOrigin}`,
  );
});
