import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

import { httpExecutor } from "builder-util";

import { AppendOnlyPublisher } from "../../scripts/release-github.mjs";

const now = Date.parse("2026-10-16T12:00:00Z");
const info = {
  provider: "github" as const,
  owner: "mokly-ai",
  repo: "mokly-desktop",
  token: "token-fixture",
  releaseType: "prerelease" as const,
  tagNamePrefix: "v",
};
const task = {
  file: "/build/Mokly.zip",
  arch: null,
  fileContent: Buffer.from("fixture data"),
};

test("the pinned publisher rejects releases older than two hours without a time bypass", async (context) => {
  context.mock.method(Date, "now", () => now);
  const original = process.env.EP_GH_IGNORE_TIME;
  context.after(() => {
    if (original === undefined) delete process.env.EP_GH_IGNORE_TIME;
    else process.env.EP_GH_IGNORE_TIME = original;
  });
  process.env.EP_GH_IGNORE_TIME = "true";
  const api: { method: string; path: string }[] = [];
  context.mock.method(httpExecutor, "doApiRequest", () => {
    throw new Error("unexpected inherited upload");
  });
  context.mock.method(
    httpExecutor,
    "request",
    async (options: { method: string; path: string }) => {
      api.push({ ...options, method: options.method ?? "GET" });
      return JSON.stringify([
        {
          id: 7,
          tag_name: "v1.2.3",
          draft: false,
          prerelease: true,
          published_at: new Date(now - 2 * 3600 * 1000 - 1).toISOString(),
        },
      ]);
    },
  );
  const uploads: string[] = [];
  const publisher = new AppendOnlyPublisher(info, "1.2.3", {
    async upload() {
      uploads.push("unexpected upload");
    },
  });
  assert.equal(process.env.EP_GH_IGNORE_TIME, undefined);
  await assert.rejects(
    publisher.upload(task),
    /skipped Mokly.zip.*new package version/s,
  );
  assert.equal(api.length, 1);
  assert.equal(api[0].method, "GET");
  assert.equal(api[0].path, "/repos/mokly-ai/mokly-desktop/releases");
  assert.deepEqual(uploads, []);
  assert.equal(publisher.uploaded.size, 0);
});

test("the pinned publisher creates one prerelease with the updater's v tag", async (context) => {
  context.mock.method(httpExecutor, "doApiRequest", () => {
    throw new Error("unexpected inherited upload");
  });
  const calls: { method: string; data: unknown }[] = [];
  context.mock.method(
    httpExecutor,
    "request",
    async (options: { method: string }, _token: unknown, data: unknown) => {
      const method = options.method ?? (data === null ? "GET" : "POST");
      calls.push({ method, data });
      return method === "GET" ? "[]" : JSON.stringify({ id: 7 });
    },
  );
  const uploads: unknown[] = [];
  const publisher = new AppendOnlyPublisher(info, "1.2.3", {
    async upload(id: number, asset: unknown) {
      uploads.push({ id, asset });
    },
  });
  await publisher.upload(task);
  assert.deepEqual(calls, [
    { method: "GET", data: null },
    {
      method: "POST",
      data: {
        tag_name: "v1.2.3",
        name: "1.2.3",
        draft: false,
        prerelease: true,
      },
    },
  ]);
  assert.deepEqual(uploads, [
    { id: 7, asset: { name: "Mokly.zip", size: 12, file: "/build/Mokly.zip" } },
  ]);
  assert.deepEqual([...publisher.uploaded], ["Mokly.zip"]);
});

test("a racing upload collision fails without invoking the inherited delete path", async (context) => {
  context.mock.method(Date, "now", () => now);
  context.mock.method(httpExecutor, "doApiRequest", () => {
    throw new Error("unexpected inherited upload");
  });
  const requests: string[] = [];
  context.mock.method(
    httpExecutor,
    "request",
    async (options: { method: string }) => {
      requests.push(options.method ?? "GET");
      assert.equal(options.method ?? "GET", "GET");
      return JSON.stringify([
        {
          id: 7,
          tag_name: "v1.2.3",
          draft: false,
          published_at: new Date(now).toISOString(),
        },
      ]);
    },
  );
  const publisher = new AppendOnlyPublisher(info, "1.2.3", {
    async upload() {
      requests.push("POST");
      throw new Error("HTTP 422 already_exists");
    },
  });
  await assert.rejects(publisher.upload(task), /422/);
  assert.deepEqual(requests, ["GET", "POST"]);
  assert.equal(publisher.uploaded.size, 0);
});
