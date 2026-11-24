import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";

import { githubClient } from "../../scripts/release-github.mjs";

const info = { owner: "mokly-ai", repo: "mokly-desktop" };
const asset = { name: "Mokly 1.zip", file: "/build/Mokly 1.zip", size: 12 };

test("release lookup by id, latest and asset pagination use GET with the token in headers", async () => {
  const calls: { url: string; options: RequestInit }[] = [];
  const draft = { id: 7, draft: true, prerelease: false, tag_name: "v1.2.3" };
  const request = async (
    url: string | URL | Request,
    options?: RequestInit,
  ) => {
    calls.push({ url: String(url), options: options! });
    const path = String(url);
    let body: unknown;
    if (path.endsWith("/releases/7")) body = draft;
    else if (path.endsWith("/releases/latest")) body = { id: 6 };
    else if (path.endsWith("page=1"))
      body = Array.from({ length: 100 }, (_, id) => ({
        name: `asset-${id}`,
        size: 12,
        state: "uploaded",
      }));
    else body = [{ name: "asset-100", size: 12, state: "uploaded" }];
    return new Response(JSON.stringify(body));
  };
  const client = githubClient(info, "token-fixture", request);
  assert.deepEqual(await client.release(7), draft);
  assert.deepEqual(await client.latest(), { id: 6 });
  assert.equal((await client.assets(7)).length, 101);
  assert.deepEqual(
    calls.map(({ url }) => url),
    [
      "https://api.github.com/repos/mokly-ai/mokly-desktop/releases/7",
      "https://api.github.com/repos/mokly-ai/mokly-desktop/releases/latest",
      "https://api.github.com/repos/mokly-ai/mokly-desktop/releases/7/assets?per_page=100&page=1",
      "https://api.github.com/repos/mokly-ai/mokly-desktop/releases/7/assets?per_page=100&page=2",
    ],
  );
  for (const { url, options } of calls) {
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "error");
    assert.equal(
      new Headers(options.headers).get("Authorization"),
      "Bearer token-fixture",
    );
    assert.equal(options.body, undefined);
    assert.ok(!url.includes("token-fixture"));
  }
});

test("promotion sends one release PATCH with the fixed body and token in the authorization header", async () => {
  const calls: { url: string; options?: RequestInit }[] = [];
  const client = githubClient(info, "token-fixture", async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response("{}");
  });
  await client.promote(7);
  await assert.rejects(
    Reflect.apply(client.promote, client, ["7/assets/4"]),
    /Invalid GitHub release ID/,
  );
  assert.deepEqual(calls, [
    {
      url: "https://api.github.com/repos/mokly-ai/mokly-desktop/releases/7",
      options: {
        method: "PATCH",
        redirect: "error",
        headers: {
          Authorization: "Bearer token-fixture",
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: '{"draft":false,"prerelease":false,"make_latest":"true"}',
      },
    },
  ]);
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
      return new Response("sensitive fixture", { status: outcome });
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
          ? (error: Error) => {
              assert.match(error.message, /HTTP 422.*new package version/s);
              assert.doesNotMatch(error.message, /sensitive fixture/);
              return true;
            }
          : /connection fixture failure/,
      );
    assert.deepEqual(methods, ["POST"]);
    assert.ok(body.destroyed);
  }
});

test("lookup and promotion errors fail without leaking the response body", async () => {
  const client = githubClient(
    info,
    "token-fixture",
    async () => new Response("sensitive fixture", { status: 403 }),
  );
  const check = (error: Error) => {
    assert.match(error.message, /HTTP 403.*new package version/s);
    assert.doesNotMatch(error.message, /sensitive fixture/);
    return true;
  };
  await assert.rejects(client.assets(7), check);
  await assert.rejects(client.promote(7), check);
});
