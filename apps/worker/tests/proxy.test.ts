import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import worker from "../src/index";

import { fetchMock } from "./outbound";

const env = { DOMAIN: "example.invalid" };

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
});

describe("application proxy", () => {
  it("disables Cloudflare caching for app-origin subrequests", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("app"));
    try {
      const response = await worker.fetch(
        new Request("https://example.invalid/dashboard"),
        env,
      );

      expect(await response.text()).toBe("app");
      expect(fetchSpy).toHaveBeenCalledWith(expect.any(Request), {
        cf: { cacheTtlByStatus: { "200-599": -1 } },
      });
      const [, init] = fetchSpy.mock.calls[0] as [
        Request,
        RequestInit & { cf?: Record<string, unknown> },
      ];
      expect(init.cf).not.toHaveProperty("cacheTtl");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("preserves the request and sets the forwarding headers", async () => {
    fetchMock
      .get("https://app-origin-pr-42.preview.example.invalid")
      .intercept({
        method: "POST",
        path: "/catalogues?branch=feature%2Fone&limit=2",
        body: "request bytes",
        headers: {
          "content-type": "application/octet-stream",
          "x-client-header": "client value",
          "x-forwarded-host": "pr-42.preview.example.invalid",
          "x-forwarded-proto": "https",
        },
      })
      .reply(201, "created");

    const response = await worker.fetch(
      new Request(
        "https://pr-42.preview.example.invalid/catalogues?branch=feature%2Fone&limit=2",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "X-Client-Header": "client value",
          },
          body: "request bytes",
        },
      ),
      env,
    );

    expect(response.status).toBe(201);
    expect(await response.text()).toBe("created");
  });

  it("passes response status, headers, cookies and bytes through", async () => {
    const body = new Uint8Array([0, 255, 16, 128, 42]);
    fetchMock
      .get("https://app-origin.example.invalid")
      .intercept({ method: "GET", path: "/_expo/asset.bin" })
      .reply(206, body, {
        headers: {
          "cache-control": "public, max-age=3600",
          "content-security-policy": "default-src 'self'",
          "content-type": "application/octet-stream",
          "set-cookie": "session=opaque; Secure; HttpOnly; SameSite=Lax",
          "x-app-header": "unchanged",
        },
      });

    const response = await worker.fetch(
      new Request("https://example.invalid/_expo/asset.bin"),
      env,
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
    expect(response.headers.get("Content-Security-Policy")).toBe(
      "default-src 'self'",
    );
    expect(response.headers.get("Content-Type")).toBe(
      "application/octet-stream",
    );
    expect(response.headers.get("Set-Cookie")).toBe(
      "session=opaque; Secure; HttpOnly; SameSite=Lax",
    );
    expect(response.headers.get("X-App-Header")).toBe("unchanged");
    expect(response.headers.has("X-Robots-Tag")).toBe(false);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(body);
  });

  it("does not convert response-wrapping failures to a preview 404", async () => {
    const originResponse = new Response("origin answered");
    await originResponse.text();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(originResponse);

    await expect(
      worker.fetch(
        new Request("https://pr-42.preview.example.invalid/dashboard"),
        env,
      ),
    ).rejects.toThrow();
    expect(fetchSpy).toHaveBeenCalledOnce();
    fetchSpy.mockRestore();
  });

  it("replaces an app robots header on preview responses", async () => {
    fetchMock
      .get("https://app-origin-main-preview.example.invalid")
      .intercept({ method: "GET", path: "/dashboard" })
      .reply(200, "preview", {
        headers: { "x-robots-tag": "index, follow" },
      });

    const response = await worker.fetch(
      new Request("https://br-main.preview.example.invalid/dashboard"),
      env,
    );

    const robotsHeaders = [...response.headers].filter(
      ([name]) => name.toLowerCase() === "x-robots-tag",
    );
    expect(robotsHeaders).toEqual([["x-robots-tag", "noindex"]]);
  });

  it("rewrites an internal Location to the public host", async () => {
    fetchMock
      .get("https://app-origin-pr-42.preview.example.invalid")
      .intercept({ method: "GET", path: "/old?source=router" })
      .reply(302, "", {
        headers: {
          location:
            "https://app-origin-pr-42.preview.example.invalid/new?source=router",
        },
      });

    const response = await worker.fetch(
      new Request("https://pr-42.preview.example.invalid/old?source=router"),
      env,
    );

    expect(response.headers.get("Location")).toBe(
      "https://pr-42.preview.example.invalid/new?source=router",
    );
  });

  it("rewrites a scheme-relative internal Location", async () => {
    fetchMock
      .get("https://app-origin-pr-42.preview.example.invalid")
      .intercept({ method: "GET", path: "/scheme-relative" })
      .reply(302, "", {
        headers: {
          location:
            "//app-origin-pr-42.preview.example.invalid/new?source=scheme-relative",
        },
      });

    const response = await worker.fetch(
      new Request("https://pr-42.preview.example.invalid/scheme-relative"),
      env,
    );

    expect(response.headers.get("Location")).toBe(
      "https://pr-42.preview.example.invalid/new?source=scheme-relative",
    );
  });

  it("rewrites a production internal Location", async () => {
    fetchMock
      .get("https://app-origin.example.invalid")
      .intercept({ method: "GET", path: "/old" })
      .reply(301, "", {
        headers: {
          location: "https://app-origin.example.invalid/new",
        },
      });

    const response = await worker.fetch(
      new Request("https://example.invalid/old"),
      env,
    );

    expect(response.headers.get("Location")).toBe(
      "https://example.invalid/new",
    );
  });

  it("leaves an unrelated Location unchanged", async () => {
    fetchMock
      .get("https://app-origin.example.invalid")
      .intercept({ method: "GET", path: "/account" })
      .reply(303, "", {
        headers: { location: "https://accounts.example.net/sign-in?next=app" },
      });

    const response = await worker.fetch(
      new Request("https://example.invalid/account"),
      env,
    );

    expect(response.headers.get("Location")).toBe(
      "https://accounts.example.net/sign-in?next=app",
    );
  });

  it.each([
    ["br-main", "app-origin-main-preview.example.invalid", "https:"],
    ["br-main", "app-origin-main-preview.example.invalid", ""],
    ["pr-42", "app-origin-pr-42.preview.example.invalid", "https:"],
    ["pr-42", "app-origin-pr-42.preview.example.invalid", ""],
  ])(
    "rewrites internal Content-Location and Link targets for %s with scheme %s",
    async (label, internal, scheme) => {
      fetchMock
        .get(`https://${internal}`)
        .intercept({ method: "GET", path: "/document" })
        .reply(200, "document", {
          headers: {
            "content-location": `${scheme}//${internal}/document?format=full#section`,
            link: `<https://${internal}/next?page=2>; rel="next", <//${internal}/asset.css>; rel="preload", <https://cdn.example.net/app.css>; rel="preload", </local>; rel="alternate"`,
          },
        });

      const response = await worker.fetch(
        new Request(`https://${label}.preview.example.invalid/document`),
        env,
      );

      expect(response.headers.get("Content-Location")).toBe(
        `https://${label}.preview.example.invalid/document?format=full#section`,
      );
      expect(response.headers.get("Link")).toBe(
        `<https://${label}.preview.example.invalid/next?page=2>; rel="next", <https://${label}.preview.example.invalid/asset.css>; rel="preload", <https://cdn.example.net/app.css>; rel="preload", </local>; rel="alternate"`,
      );
    },
  );

  it("preserves the ingress 404 for an unprovisioned PR with noindex", async () => {
    const body = "default backend - 404\n";
    const headers = {
      "content-type": "text/plain; charset=UTF-8",
      "cache-control": "public, max-age=30",
      "content-security-policy": "default-src 'none'",
      "x-origin-header": "ingress-default-backend",
    };
    fetchMock
      .get("https://app-origin-pr-84.preview.example.invalid")
      .intercept({ method: "GET", path: "/sign-in" })
      .reply(404, body, { headers: { ...headers, "x-robots-tag": "index" } });

    const response = await worker.fetch(
      new Request("https://pr-84.preview.example.invalid/sign-in"),
      env,
    );

    expect(response.status).toBe(404);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new TextEncoder().encode(body),
    );
    expect(Object.fromEntries(response.headers)).toEqual({
      ...headers,
      "x-robots-tag": "noindex",
    });
  });
});
