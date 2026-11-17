import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { githubClient } from "../../scripts/release-github.mjs";

const info = { owner: "mokly-ai", repo: "mokly-desktop" };
const asset = { name: "Mokly 1.zip", file: "/build/Mokly 1.zip", size: 12 };

test("release lookup and asset pagination use only GET with the token in headers", async () => {
  const calls: { url: string; options: RequestInit }[] = [];
  const request = async (
    url: string | URL | Request,
    options?: RequestInit,
  ) => {
    calls.push({ url: String(url), options: options! });
    const body = String(url).includes("/tags/")
      ? { id: 7 }
      : String(url).endsWith("page=1")
        ? Array.from({ length: 100 }, (_, id) => ({ name: `asset-${id}` }))
        : [{ name: "asset-100" }];
    return new Response(JSON.stringify(body));
  };
  const client = githubClient(info, "token-fixture", request);
  assert.deepEqual(await client.release("v1.2.3"), { id: 7 });
  assert.equal((await client.assets(7)).length, 101);
  assert.deepEqual(
    calls.map(({ url }) => url),
    [
      "https://api.github.com/repos/mokly-ai/mokly-desktop/releases/tags/v1.2.3",
      "https://api.github.com/repos/mokly-ai/mokly-desktop/releases/7/assets?per_page=100&page=1",
      "https://api.github.com/repos/mokly-ai/mokly-desktop/releases/7/assets?per_page=100&page=2",
    ],
  );
  for (const { url, options } of calls) {
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "error");
    assert.equal(
      (options.headers as Record<string, string>).Authorization,
      "Bearer token-fixture",
    );
    assert.ok(!url.includes("token-fixture"));
  }
});

test("uploads use one POST and close the stream on success, collision or network error", async () => {
  for (const outcome of [201, 422, "network-error"] as const) {
    const methods: string[] = [];
    const body = Readable.from(["fixture data"]);
    const request = async (
      url: string | URL | Request,
      options?: RequestInit,
    ) => {
      methods.push(options!.method!);
      assert.equal(
        String(url),
        "https://uploads.github.com/repos/mokly-ai/mokly-desktop/releases/7/assets?name=Mokly%201.zip",
      );
      const headers = options!.headers as Record<string, string>;
      assert.equal(headers.Authorization, "Bearer token-fixture");
      assert.equal(headers["Content-Length"], "12");
      assert.equal(options!.body, body);
      if (outcome === "network-error")
        throw new Error("connection fixture failure");
      return new Response("{}", { status: outcome });
    };
    const client = githubClient(
      info,
      "token-fixture",
      request,
      (file: string) => {
        assert.equal(file, asset.file);
        return body;
      },
    );
    const upload = client.upload(7, asset);
    if (outcome === 201) await upload;
    else
      await assert.rejects(
        upload,
        outcome === 422
          ? /HTTP 422.*new package version/s
          : /connection fixture failure/,
      );
    assert.deepEqual(methods, ["POST"]);
    assert.ok(body.destroyed);
  }
});

test("asset lookup errors fail and do not leak the response body", async () => {
  const client = githubClient(
    info,
    "token-fixture",
    async () => new Response("sensitive fixture", { status: 403 }),
  );
  await assert.rejects(client.assets(7), (error: Error) => {
    assert.match(error.message, /HTTP 403.*new package version/s);
    assert.ok(!error.message.includes("sensitive fixture"));
    return true;
  });
});
