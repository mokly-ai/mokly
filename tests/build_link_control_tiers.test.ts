import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { generatedText } from "../dist/build/generated_file.js";
import { loadConfig } from "../dist/config/load.js";
import { MoklyError } from "../dist/errors.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";

function source(body: string): string {
  return validEntrySource({ body }).replace(
    'import React from "react";',
    'import React from "react"; import { MockLink } from "@mokly/mokly";',
  );
}

const control = (content = "Continue") =>
  `<MockLink asChild to="details"><span>${content}</span></MockLink>`;
const warningMessage = (element: string) =>
  `MockLink child control is inside <${element}>; one click or key press has two targets`;

test("a main focus target silently contains a styled link", async (t) => {
  const fixture = await createFixture(
    source(`<main tabIndex={-1}>${control()}</main>`),
  );
  t.after(() => removeFixture(fixture));

  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  assert.deepEqual(compilation.diagnostics, []);
  assert.match(
    generatedText(
      compilation.outputs.get("home/index.desktop.html"),
      "home/index.desktop.html",
    ) ?? "",
    /<main tabindex="-1"><a /,
  );
});

test("a button ancestor produces sorted diagnostics without changing adapted bytes", async (t) => {
  const fixture = await createFixture(source(`<button>${control()}</button>`));
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const warned = await compileCatalogue(config);
  assert.deepEqual(warned.diagnostics, [
    {
      code: "link-control-ancestor",
      route: "home/index.desktop.html",
      message: warningMessage("button"),
    },
    {
      code: "link-control-ancestor",
      route: "home/index.mobile.html",
      message: warningMessage("button"),
    },
  ]);

  await fs.writeFile(fixture.entryPath, source(`<div>${control()}</div>`));
  const silent = await compileCatalogue(config);
  assert.deepEqual(silent.diagnostics, []);
  for (const route of ["home/index.desktop.html", "home/index.mobile.html"])
    assert.equal(
      generatedText(warned.outputs.get(route), route)
        ?.replace("<button>", "<div>")
        .replace("</button>", "</div>"),
      silent.outputs.get(route),
      route,
    );
});

test("a link ancestor fails with the offending element named", async (t) => {
  const fixture = await createFixture(
    source(`<a href="mock:home">${control()}</a>`),
  );
  t.after(() => removeFixture(fixture));

  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    (error: unknown) =>
      error instanceof MoklyError &&
      error.message.includes(
        "MockLink child control is inside <a>; move the control outside it",
      ),
  );
});

test("a focus-only descendant produces one warning per generated fragment", async (t) => {
  const fixture = await createFixture(
    source(
      '<MockLink asChild to="details"><span><span tabIndex={-1}>Focus</span></span></MockLink>',
    ),
  );
  t.after(() => removeFixture(fixture));

  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  assert.deepEqual(
    compilation.diagnostics.map(({ code, route }) => ({ code, route })),
    [
      {
        code: "link-control-descendant",
        route: "home/index.desktop.html",
      },
      {
        code: "link-control-descendant",
        route: "home/index.mobile.html",
      },
    ],
  );
  assert.ok(
    compilation.diagnostics.every(
      ({ message }) =>
        message ===
        'MockLink child control contains <span tabindex="-1">; the link has an extra focus stop',
    ),
  );
});

test("several controls produce route-then-message sorted diagnostics", async (t) => {
  const fixture = await createFixture(
    source(
      `<label>${control("Label")}</label><button>${control("Button")}</button>`,
    ),
  );
  t.after(() => removeFixture(fixture));

  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  assert.deepEqual(
    compilation.diagnostics.map(({ route, message }) => [route, message]),
    ["desktop", "mobile"].flatMap((viewport) => [
      [`home/index.${viewport}.html`, warningMessage("button")],
      [`home/index.${viewport}.html`, warningMessage("label")],
    ]),
  );
});
