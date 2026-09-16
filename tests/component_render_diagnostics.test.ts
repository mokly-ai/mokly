import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { componentRuntime } from "../dist/build/component_runtime.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentReviewFixture } from "./helpers/component_review_fixture.js";

test("preview-resource exclusions reach stderr without exposing the cause in HTTP", async (t) => {
  const fixture = await componentReviewFixture(
    t,
    (source) => source,
    componentEntrySource({
      actionRender:
        '(props) => props.label === "Private" ? <img src="../README.svg" /> : <button>{props.label}</button>',
    }),
  );
  await fs.writeFile(
    path.join(fixture.mockupsDir, "README.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" />',
  );
  const server = await startCatalogueServer(fixture.config, {
    base: "main",
    port: 0,
    componentRuntime: componentRuntime(fixture.after),
  });
  t.after(() => server.close());
  const page = await (
    await fetch(`${server.url}/view/components/action.html`)
  ).text();
  const { renderCapability } = JSON.parse(
    page.match(/data-workspace-data="">(.*?)<\/script>/s)![1]!,
  );
  const stderr: string[] = [];
  t.mock.method(process.stderr, "write", (chunk: string) => {
    stderr.push(String(chunk));
    return true;
  });
  const response = await fetch(`${server.url}/__mokly/components/render`, {
    method: "POST",
    headers: {
      origin: server.url,
      "content-type": "application/json",
      "x-mokly-render-token": renderCapability.token,
    },
    body: JSON.stringify({
      componentId: "action",
      variantId: "default",
      viewport: "mobile",
      colorScheme: "light",
      generation: renderCapability.generation,
      pageId: "d".repeat(32),
      overrides: { label: { kind: "set", value: ["string", "Private"] } },
    }),
  });
  const body = await response.text();
  assert.equal(response.status, 422);
  assert.deepEqual(JSON.parse(body), {
    code: "render-failed",
    message: "The preview could not be rendered. Try again or reset the props.",
  });
  assert.doesNotMatch(
    body,
    /README\.svg|publicExclude|exclusion|referenced by/,
  );
  assert.ok(
    stderr.some(
      (line) =>
        /README\.svg/.test(line) &&
        /components\/action/.test(line) &&
        /matches public exclusion.*\*\*\/README\.\*.*publicExclude/.test(
          line,
        ) &&
        line.endsWith("\n"),
    ),
    `expected a server diagnostic containing the exclusion cause, got ${JSON.stringify(stderr)}`,
  );
});
