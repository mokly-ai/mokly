import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import type { APIRequestContext } from "@playwright/test";

import {
  assertDesignResource,
  designResourceExists,
  unexpectedDesignScripts,
} from "./browser/design_fixture.js";

test("file resources stay inside the built directory and missing resources return false", async (context) => {
  const parent = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-design-links-"),
  );
  const root = path.join(parent, "site");
  const prior = process.env["MOKLY_PLAYWRIGHT_FILE_DIR"];
  context.after(async () => {
    if (prior === undefined) delete process.env["MOKLY_PLAYWRIGHT_FILE_DIR"];
    else process.env["MOKLY_PLAYWRIGHT_FILE_DIR"] = prior;
    await fs.rm(parent, { recursive: true, force: true });
  });
  await fs.mkdir(root);
  await fs.writeFile(path.join(root, "index.html"), "home");
  await fs.writeFile(path.join(parent, "outside.html"), "outside");
  await fs.symlink(
    path.join(parent, "outside.html"),
    path.join(root, "escape.html"),
  );
  process.env["MOKLY_PLAYWRIGHT_FILE_DIR"] = root;
  const document = pathToFileURL(path.join(root, "index.html")).href;
  const request = {
    get: () => {
      throw new Error("file mode must use disk");
    },
  } as unknown as APIRequestContext;
  await assertDesignResource(`${document}#section`, document);
  assert.equal(
    await designResourceExists(request, `${document}?ignored#section`),
    true,
  );
  assert.equal(
    await designResourceExists(
      request,
      pathToFileURL(path.join(root, "missing.html")).href,
    ),
    false,
  );
  for (const target of [
    path.join(parent, "outside.html"),
    path.join(root, "escape.html"),
  ])
    await assert.rejects(
      assertDesignResource(pathToFileURL(target).href, document),
      /leaves file output/,
    );
  await assert.rejects(
    assertDesignResource("https://outside.test/", document),
    /leaves file output/,
  );
  await assertDesignResource(
    "https://site.test/style.css",
    "https://site.test/page.html",
  );
  await assert.rejects(
    assertDesignResource(
      "https://outside.test/",
      "https://site.test/page.html",
    ),
    /leaves catalogue origin/,
  );
});

test("only static and file delivery allow the published inspector script", (context) => {
  const names = [
    "MOKLY_PLAYWRIGHT_STATIC_DIR",
    "MOKLY_PLAYWRIGHT_FILE_DIR",
  ] as const;
  const previous = names.map((name) => process.env[name]);
  context.after(() =>
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    }),
  );
  names.forEach((name) => {
    delete process.env[name];
  });
  assert.equal(unexpectedDesignScripts(), "script");
  for (const name of names) {
    process.env[name] = "/output";
    assert.equal(
      unexpectedDesignScripts(),
      'script:not([src="/mokly-viewer/client/inspector.js"])',
    );
    delete process.env[name];
  }
});
