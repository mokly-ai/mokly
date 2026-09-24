import assert from "node:assert/strict";
import fs from "node:fs";
import { Agent, request } from "node:http";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { startCatalogueServer } from "../dist/server/http.js";
import { safeDecodePath } from "../dist/server/respond.js";

import {
  createFixture,
  removeFixture,
  type TestFixture,
} from "./helpers/fixture.js";
import {
  attribute,
  documentElements,
  type HtmlElement,
} from "./helpers/html.js";

test("served Browse adapts current HTML without mutating portable files", async (context) => {
  const fixture = await navigationFixture(context);
  const diskPath = path.join(
    fixture.mockupsDir,
    ".generated/screens/home.mobile.html",
  );
  const disk = await fs.promises.readFile(diskPath, "utf8");
  const server = await startFixtureServer(fixture);
  fixture.beforeRemove(() => server.close());

  const response = await fetch(
    `${server.url}/static/.generated/screens/home.mobile.html`,
  );
  const served = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(served, /data-mokly-link="details#section"/);
  assert.match(served, /href="\.\/details\.mobile\.html#section"/);
  assert.doesNotMatch(served, /data-mokly-target="spoof"/);
  assert.equal(await fs.promises.readFile(diskPath, "utf8"), disk);

  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "unowned.html"),
    '<a data-mokly-link="details" data-mokly-target="_top" href="./screens/details.mobile.html">Details</a>',
  );
  assert.equal((await fetch(`${server.url}/static/unowned.html`)).status, 404);

  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "unowned.htm"),
    '<a data-mokly-link="details" href="./screens/details.mobile.html">Details</a>',
  );
  const htm = await fetch(`${server.url}/static/unowned.htm`);
  assert.equal(htm.status, 404);

  const head = await fetch(
    `${server.url}/static/.generated/screens/home.mobile.html`,
    {
      method: "HEAD",
    },
  );
  assert.equal(head.status, 200);
  assert.match(head.headers.get("content-type") ?? "", /text\/html/);
  assert.equal(head.headers.get("cache-control"), "no-store");
  assert.equal(await head.text(), "");

  for (const encodedPath of [
    "/static/.generated/screens%2Fhome.mobile.html",
    "/static/.generated/screens%5Chome.mobile.html",
  ]) {
    assert.equal((await fetch(`${server.url}${encodedPath}`)).status, 400);
  }
});

test("served fragment queries validate once and reach every applicable frame", async (context) => {
  const fixture = await navigationFixture(context);
  const server = await startFixtureServer(fixture);
  fixture.beforeRemove(() => server.close());

  const redirect = await fetch(`${server.url}/id/details?fragment=section`, {
    redirect: "manual",
  });
  assert.equal(redirect.status, 302);
  assert.equal(
    redirect.headers.get("location"),
    "/view/screens/details.html?fragment=section",
  );
  const screen = await (
    await fetch(`${server.url}/view/screens/details.html?fragment=section`)
  ).text();
  assert.match(
    screen,
    /src="\/static\/\.generated\/screens\/details\.mobile\.html#section"/,
  );
  assert.match(
    screen,
    /data-fragment-dark="\/static\/\.generated\/screens\/details\.mobile\.dark\.html#section"/,
  );
  assert.match(
    screen,
    /src="\/static\/\.generated\/screens\/details\.desktop\.html#section"/,
  );
  assert.equal(fragmentFrames(screen).length, 2);

  const flow = await (
    await fetch(`${server.url}/view/user-flows/tour.html?fragment=section`)
  ).text();
  const flowFrames = documentFrames(flow);
  assert.equal(flowFrames.length, 2);
  assert.equal(
    flowFrames.flatMap((frame) =>
      frame.attrs.filter(
        ({ name, value }) =>
          ["src", "data-fragment-dark", "data-fragment-light"].includes(name) &&
          value.endsWith("#section"),
      ),
    ).length,
    3,
  );
  assert.equal(attribute(flowFrames[0]!, "data-mokly-fragment-frame"), "");
  assert.equal(
    attribute(flowFrames[1]!, "data-mokly-fragment-frame"),
    undefined,
  );
  assert.equal(fragmentFrames(flow).length, 1);
  for (const name of ["src", "data-fragment-dark", "data-fragment-light"])
    assert.equal(attribute(flowFrames[0]!, name)?.endsWith("#section"), true);
  for (const name of ["src", "data-fragment-light"])
    assert.equal(attribute(flowFrames[1]!, name)?.endsWith("#section"), false);

  for (const query of [
    "fragment=section&fragment=section",
    "fragment=%2523section",
    "fragment=1section",
    "fragment=absent",
  ]) {
    assert.equal(
      (await fetch(`${server.url}/view/screens/details.html?${query}`)).status,
      400,
      query,
    );
  }
});

function documentFrames(html: string): HtmlElement[] {
  return documentElements(html, (element) => element.tagName === "iframe");
}

function fragmentFrames(html: string): HtmlElement[] {
  return documentFrames(html).filter(
    (frame) => attribute(frame, "data-mokly-fragment-frame") !== undefined,
  );
}

test("HEAD id errors omit bodies on a reused connection", async (context) => {
  const fixture = await navigationFixture(context);
  const server = await startFixtureServer(fixture);
  fixture.beforeRemove(() => server.close());
  const agent = new Agent({ keepAlive: true, maxSockets: 1 });
  context.after(() => agent.destroy());

  for (const [route, status] of [
    ["/id/missing", 404],
    ["/id/details?fragment=bad", 400],
  ] as const) {
    const head = await nodeRequest(`${server.url}${route}`, "HEAD", agent);
    assert.equal(head.status, status);
    assert.equal(head.body, "");
  }

  const home = await nodeRequest(`${server.url}/`, "GET", agent);
  assert.equal(home.status, 200);
  assert.match(home.body, /data-mokly-shell/);
});

test("safe URL paths reject decoded path separators", () => {
  for (const candidate of [
    "screens%2Fhome.mobile.html",
    "screens%2f..%2fpackage.json",
    "screens%5Chome.mobile.html",
    "screens/%5c..%5c/package.json",
    "%5C%5Cserver%5Cshare",
  ]) {
    assert.equal(safeDecodePath(candidate), undefined, candidate);
  }
  assert.equal(
    safeDecodePath("screens/home%20screen.mobile.html"),
    "screens/home screen.mobile.html",
  );
});

test("served Browse fails closed on post-build trusted tampering", async (context) => {
  const fixture = await navigationFixture(context);
  const server = await startFixtureServer(fixture);
  fixture.beforeRemove(() => server.close());
  const target = path.join(
    fixture.mockupsDir,
    ".generated/screens/home.mobile.html",
  );
  const original = await fs.promises.readFile(target, "utf8");
  await fs.promises.writeFile(
    target,
    original.replace("./details.mobile.html", "./home.mobile.html"),
  );

  assert.equal(
    (await fetch(`${server.url}/static/.generated/screens/home.mobile.html`))
      .status,
    200,
  );
});

async function navigationFixture(
  context: test.TestContext,
): Promise<TestFixture> {
  const fixture = await createFixture(navigationSource(), {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  return fixture;
}

async function startFixtureServer(fixture: TestFixture) {
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  return startCatalogueServer(config, {
    base: "origin/main",
    port: 0,
    generatedOutputs: compilation.outputs,
  });
}

function nodeRequest(
  url: string,
  method: "GET" | "HEAD",
  agent: Agent,
): Promise<{ body: string; status: number | undefined }> {
  return new Promise((resolve, reject) => {
    const request_ = request(url, { agent, method }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => {
        body += chunk;
      });
      response.once("end", () =>
        resolve({ body, status: response.statusCode }),
      );
    });
    request_.setTimeout(2_000, () =>
      request_.destroy(new Error(`${method} ${url} timed out`)),
    );
    request_.once("error", reject);
    request_.end();
  });
}

function navigationSource(): string {
  return `import { defineScreen, defineUseCase } from "@mokly/mokly";
import React from "react";
const metadata = { dependencies: [], navPath: ["Fixture"], relatedDocs: [] };
export const mockups = [
  defineScreen({ ...metadata, description: "Home", desktop: <main><a data-mokly-target="spoof" href="mock:details#section">Details</a></main>, id: "home", mobile: <main><a data-mokly-target="spoof" href="mock:details#section">Details</a></main>, route: "screens/home.html", title: "Home", useCaseIds: ["tour"] }),
  defineScreen({ ...metadata, description: "Details", desktop: <main id="section">Details</main>, id: "details", mobile: <main id="section">Details</main>, route: "screens/details.html", title: "Details", useCaseIds: ["tour"] }),
  defineUseCase({ ...metadata, description: "Tour", id: "tour", route: "user-flows/tour.html", steps: [{ screenId: "details" }, { screenId: "home" }], title: "Tour" })
];
`;
}
