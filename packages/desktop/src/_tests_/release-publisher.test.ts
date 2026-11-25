import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import type { TestContext } from "node:test";

import { httpExecutor } from "builder-util";

import { AppendOnlyPublisher } from "../../scripts/release-publisher.mjs";

const info = {
  provider: "github" as const,
  owner: "mokly-ai",
  repo: "mokly-desktop",
  token: "token-fixture",
  releaseType: "draft" as const,
  tagNamePrefix: "v",
};
const task = {
  file: "/build/Mokly-mac-arm64.zip",
  arch: null,
  fileContent: Buffer.from("fixture data"),
};

function releaseRequests(context: TestContext, releases: object[]) {
  const calls: { method: string; path: string; data: unknown }[] = [];
  context.mock.method(httpExecutor, "doApiRequest", () => {
    throw new Error("unexpected inherited upload");
  });
  context.mock.method(
    httpExecutor,
    "request",
    async (
      options: { method?: string; path: string },
      _token: unknown,
      data: unknown,
    ) => {
      const method = options.method ?? (data === null ? "GET" : "POST");
      calls.push({ method, path: options.path, data });
      return JSON.stringify(method === "GET" ? releases : { id: 7 });
    },
  );
  return calls;
}

test("an existing published release skips uploads and ignores publisher overrides", async (context) => {
  const overrides = ["EP_GH_IGNORE_TIME", "EP_PRE_RELEASE", "EP_PRELEASE"];
  for (const key of overrides) {
    const original = process.env[key];
    context.after(() => {
      if (original === undefined) delete process.env[key];
      else process.env[key] = original;
    });
    process.env[key] = "true";
  }
  const calls = releaseRequests(context, [
    { id: 7, tag_name: "v1.2.3", draft: false, prerelease: false },
  ]);
  const uploads: number[] = [];
  const publisher = new AppendOnlyPublisher(info, "1.2.3", {
    async upload(id) {
      uploads.push(id);
    },
  });
  for (const key of overrides) assert.equal(process.env[key], undefined, key);
  await assert.rejects(
    publisher.upload(task),
    /skipped Mokly-mac-arm64\.zip.*new package version/s,
  );
  assert.deepEqual(calls, [
    {
      method: "GET",
      path: "/repos/mokly-ai/mokly-desktop/releases",
      data: null,
    },
  ]);
  assert.deepEqual(uploads, []);
  assert.equal(publisher.uploaded.size, 0);
});

test("the first publisher creates a draft with the updater's v tag", async (context) => {
  const calls = releaseRequests(context, []);
  const uploads: unknown[] = [];
  const publisher = new AppendOnlyPublisher(info, "1.2.3", {
    async upload(id, asset) {
      uploads.push({ id, asset });
    },
  });
  await publisher.upload(task);
  assert.deepEqual(calls, [
    {
      method: "GET",
      path: "/repos/mokly-ai/mokly-desktop/releases",
      data: null,
    },
    {
      method: "POST",
      path: "/repos/mokly-ai/mokly-desktop/releases",
      data: {
        tag_name: "v1.2.3",
        name: "1.2.3",
        draft: true,
        prerelease: false,
      },
    },
  ]);
  assert.deepEqual(uploads, [
    {
      id: 7,
      asset: {
        name: "Mokly-mac-arm64.zip",
        size: 12,
        file: "/build/Mokly-mac-arm64.zip",
      },
    },
  ]);
  assert.deepEqual([...publisher.uploaded], ["Mokly-mac-arm64.zip"]);
});

test("the second publisher reuses the draft and uploads to its id", async (context) => {
  const calls = releaseRequests(context, [
    { id: 8, tag_name: "v1.2.2", draft: true, prerelease: false },
    { id: 9, tag_name: "v1.2.3", draft: true, prerelease: false },
  ]);
  const uploads: number[] = [];
  const publisher = new AppendOnlyPublisher(info, "1.2.3", {
    async upload(id) {
      uploads.push(id);
    },
  });
  await publisher.upload(task);
  assert.deepEqual(calls, [
    {
      method: "GET",
      path: "/repos/mokly-ai/mokly-desktop/releases",
      data: null,
    },
  ]);
  assert.deepEqual(uploads, [9]);
});

test("a racing upload collision fails without invoking the inherited delete path", async (context) => {
  const calls = releaseRequests(context, [
    { id: 7, tag_name: "v1.2.3", draft: true, prerelease: false },
  ]);
  const uploads: number[] = [];
  const publisher = new AppendOnlyPublisher(info, "1.2.3", {
    async upload(id) {
      uploads.push(id);
      throw new Error("HTTP 422 already_exists");
    },
  });
  await assert.rejects(publisher.upload(task), /422/);
  assert.deepEqual(calls, [
    {
      method: "GET",
      path: "/repos/mokly-ai/mokly-desktop/releases",
      data: null,
    },
  ]);
  assert.deepEqual(uploads, [7]);
  assert.equal(publisher.uploaded.size, 0);
});
