import { fetchMock } from "./outbound";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import worker from "../src/index";

const env = { DOMAIN: "example.invalid" };

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
});

async function fetchPublic(url: string): Promise<Response> {
  return worker.fetch(new Request(url), env);
}

async function fetchWithoutSubrequest(url: string): Promise<Response> {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  try {
    const response = await fetchPublic(url);
    expect(fetchSpy).not.toHaveBeenCalled();
    return response;
  } finally {
    fetchSpy.mockRestore();
  }
}

function mockOrigin(host: string, path: string, body: string): void {
  fetchMock
    .get(`https://${host}`)
    .intercept({ method: "GET", path })
    .reply(200, body);
}

describe("production route ownership", () => {
  it.each([
    "/",
    "/docs/x",
    "/changelog",
    "/complaints",
    "/robots.txt",
    "/security/",
    "/.well-known/acme-challenge/token",
  ])("passes the site route %s through to Pages", async (path) => {
    mockOrigin("example.invalid", path, `site ${path}`);

    const response = await fetchPublic(`https://example.invalid${path}`);

    expect(response.status).toBe(200);
    expect(response.headers.has("X-Robots-Tag")).toBe(false);
    expect(await response.text()).toBe(`site ${path}`);
  });

  it.each(["/sign-in", "/acme/website", "/dashboard"])(
    "proxies the application route %s",
    async (path) => {
      mockOrigin("app-origin.example.invalid", path, `app ${path}`);

      const response = await fetchPublic(`https://example.invalid${path}`);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe(`app ${path}`);
    },
  );
});

describe("preview host routing", () => {
  it.each(["/", "/docs/x", "/sign-in"])(
    "proxies %s to the pull-request app",
    async (path) => {
      mockOrigin("app-origin-pr-42.preview.example.invalid", path, "preview");

      const response = await fetchPublic(
        `https://pr-42.preview.example.invalid${path}`,
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
      expect(await response.text()).toBe("preview");
    },
  );

  it.each(["1", "999999999"])(
    "accepts the pull-request number boundary %s",
    async (number) => {
      mockOrigin(
        `app-origin-pr-${number}.preview.example.invalid`,
        "/dashboard",
        number,
      );

      const response = await fetchPublic(
        `https://pr-${number}.preview.example.invalid/dashboard`,
      );

      expect(response.status).toBe(200);
      expect(await response.text()).toBe(number);
    },
  );

  it("maps br-main to the main-preview app origin", async () => {
    mockOrigin(
      "app-origin-main-preview.example.invalid",
      "/sign-in",
      "main preview",
    );

    const response = await fetchPublic(
      "https://br-main.preview.example.invalid/sign-in",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(await response.text()).toBe("main preview");
  });

  it("maps a general branch label to its preview app origin", async () => {
    mockOrigin(
      "app-origin-release-preview.example.invalid",
      "/dashboard",
      "release preview",
    );

    const response = await fetchPublic(
      "https://br-release.preview.example.invalid/dashboard",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(await response.text()).toBe("release preview");
  });
});

describe("synthetic responses", () => {
  it.each(["pr-84", "br-feature"])(
    "returns the router 404 for unresolved valid preview %s",
    async (label) => {
      const response = await fetchPublic(
        `https://${label}.preview.example.invalid/dashboard`,
      );

      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
      expect(await response.text()).toBe("");
    },
  );

  it.each([
    "br--release.preview.example.invalid",
    "br-release-.preview.example.invalid",
    "pr-0.preview.example.invalid",
    "pr-01.preview.example.invalid",
    "pr-1000000000.preview.example.invalid",
    "pr-1.extra.preview.example.invalid",
    "pr_1.preview.example.invalid",
    ".preview.example.invalid",
    `${"a".repeat(64)}.preview.example.invalid`,
  ])("rejects the unsupported host %s without a subrequest", async (host) => {
    const response = await fetchWithoutSubrequest(`https://${host}/dashboard`);

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(await response.text()).toBe("");
  });

  it("rejects an unrelated host without preview headers", async () => {
    const response = await fetchWithoutSubrequest(
      "https://other.invalid/dashboard",
    );

    expect(response.status).toBe(404);
    expect(response.headers.has("X-Robots-Tag")).toBe(false);
    expect(await response.text()).toBe("");
  });

  it.each(["/", "/app", "/sign-in", "/_router-health"])(
    "rejects a direct PR internal-host request to %s without a subrequest",
    async (path) => {
      const response = await fetchWithoutSubrequest(
        `https://app-origin-pr-42.preview.example.invalid${path}`,
      );

      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.get("Content-Type")).toBe(
        "text/plain; charset=UTF-8",
      );
      expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
      expect(await response.text()).toBe("");
    },
  );

  it.each([
    ["example.invalid", null],
    ["br-main.preview.example.invalid", "noindex"],
    ["pr-42.preview.example.invalid", "noindex"],
  ])("answers health for %s without a subrequest", async (host, robots) => {
    const response = await fetchWithoutSubrequest(
      `https://${host}/_router-health`,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/plain; charset=UTF-8",
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Robots-Tag")).toBe(robots);
    expect(await response.text()).toBe("ok");
  });
});
