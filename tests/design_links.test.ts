import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import { parse } from "parse5";

import {
  entryRoute,
  generatedViews,
  viewRoute,
} from "../packages/viewer/dist/data.js";
import type { ManifestScreen } from "../packages/viewer/dist/registry/types.js";

import {
  attribute,
  byClass,
  designCatalogue,
  designEntries,
  designDocument,
  elements,
  textContent,
} from "./helpers/design_catalogue.js";
import { textOutput } from "./helpers/generated_text.js";

test("shared library sample links and stylesheets use relative local URLs", async () => {
  const { outputs } = await designCatalogue;
  const entries = await designEntries(
    (entry) =>
      entry.kind === "component" &&
      "variantOf" in entry &&
      entry.path.startsWith("design/library/"),
    "portable library samples",
  );
  let links = 0;
  let stylesheets = 0;
  for (const entry of entries) {
    for (const view of generatedViews(entry)) {
      const html = textOutput(outputs, view.path);
      assert.ok(html, view.path);
      for (const link of elements(
        parse(html),
        (node) =>
          node.tagName === "a" ||
          (node.tagName === "link" && attribute(node, "rel") === "stylesheet"),
      )) {
        const href = attribute(link, "href");
        assert.ok(href, view.path);
        assert.doesNotMatch(
          href,
          /^(?:[a-z][a-z\d+.-]*:|\/)/iu,
          `${view.path}: ${href}`,
        );
        if (link.tagName === "a") links += 1;
        else stylesheets += 1;
      }
    }
  }
  assert.ok(links > 0, "library samples contain links");
  assert.ok(stylesheets > 0, "library samples contain stylesheets");
});

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: design actions navigate to the subject's owning screen`, async () => {
    for (const [source, className, targets] of [
      [
        "design/browse/views/home",
        "mbk-empty-link",
        ["design/browse/views/screen"],
      ],
      [
        "design/browse/states/missing-route",
        "mbk-empty-link",
        ["design/browse/views/home"],
      ],
      [
        "design/browse/views/screen",
        "mbk-shot-link",
        ["design/browse/views/details-screen"],
      ],
      [
        "design/browse/views/details-screen",
        "mbk-shot-link",
        ["design/browse/views/screen"],
      ],
      [
        "design/browse/views/use-case",
        "flow-step-link",
        ["design/browse/views/screen", "design/browse/views/details-screen"],
      ],
      [
        "design/browse/states/details",
        "flow",
        ["design/browse/views/use-case"],
      ],
    ] as const) {
      const { document } = await designDocument(source, viewport);
      const controls = byClass(document, className).filter(
        (node) => className !== "flow" || byClass(node, "mbk-chip").length,
      );
      assert.ok(controls.length > 0, `${source}: missing ${className}`);
      assert.deepEqual(
        [
          ...new Set(
            controls.map((node) => attribute(node, "data-mokly-link")),
          ),
        ],
        targets,
        `${source}: ${className}`,
      );
      for (const node of controls) assert.equal(node.tagName, "a");
      if (className === "flow-step-link") {
        for (const node of controls)
          assert.ok(
            textContent(node).includes(
              attribute(node, "data-mokly-link") ?? "missing",
            ),
          );
      }
    }
    const removed = await designDocument(
      "design/changes/outcomes/removed",
      viewport,
    );
    assert.equal(byClass(removed.document, "mbk-shot-link").length, 0);
    assert.equal(byClass(removed.document, "mbk-empty-link").length, 0);
  });

  test(`${viewport}: navigation chrome uses explicit leaves and canonical recovery`, async () => {
    const { document } = await designDocument(
      "design/browse/states/navigation",
      viewport,
    );
    assert.equal(
      attribute(byClass(document, "mbk-brand")[0]!, "data-mokly-link"),
      "design/browse/views/home",
    );
    const links = byClass(document, "mbk-nav-row").filter(
      (node) => node.tagName === "a",
    );
    assert.deepEqual(
      links.map((node) => [
        textContent(node).trim(),
        attribute(node, "data-mokly-link"),
      ]),
      [
        ["Overview", "design/browse/views/folder-overview"],
        ["Welcome", "design/browse/views/screen"],
        ["Details", "design/browse/views/details-screen"],
        ["Example tour", "design/browse/views/use-case"],
        ["Getting started", "design/browse/pages/view"],
        ["Payment terms", "design/browse/pages/document"],
        ["Profile", "design/browse/index-entries/screen"],
        ["Action", "design/components/overview"],
        ["Default", "design/components/overview"],
        ["Disabled", "design/components/pages/variants"],
        ["Toolbar", "design/components/pages/toolbar"],
        ["Default", "design/components/pages/toolbar"],
      ],
    );
    assert.equal(
      attribute(byClass(document, "mbk-menu-btn")[0]!, "data-mokly-link"),
      "design/browse/views/home",
    );
    assert.match(
      attribute(byClass(document, "mbk-menu-btn")[0]!, "aria-label") ?? "",
      /Close/,
    );
    if (viewport === "mobile") {
      const home = await designDocument("design/browse/views/home", viewport);
      assert.equal(
        attribute(
          byClass(home.document, "mbk-menu-btn")[0]!,
          "data-mokly-link",
        ),
        "design/browse/states/navigation",
      );
    }
  });
}

test("every design link resolves to a real same-viewport design artifact without scripts or nested controls", async () => {
  const designs = await designEntries(
    (entry): entry is ManifestScreen =>
      entry.kind === "screen" && entry.path.startsWith("design/"),
    "same-viewport design links",
  );
  const componentDesigns = designs.filter((entry) =>
    entry.path.startsWith("design/components/"),
  );
  assert.equal(componentDesigns.length, 39);
  assert.equal(designs.length - componentDesigns.length, 72);
  for (const entry of designs) {
    for (const viewport of ["mobile", "desktop"] as const) {
      const { document, route } = await designDocument(entry.path, viewport);
      const links = elements(document, (node) => node.tagName === "a");
      assert.ok(links.length > 0, entry.path);
      assert.equal(
        elements(document, (node) => node.tagName === "script").length,
        0,
      );
      for (const link of links) {
        const id = attribute(link, "data-mokly-link");
        const target = designs.find((entry) => entry.path === id);
        assert.ok(
          target?.kind === "screen",
          `${entry.path}: invalid target ${id}`,
        );
        const href = attribute(link, "href");
        assert.ok(href);
        assert.equal(
          path.posix.normalize(
            path.posix.join(path.posix.dirname(route), href),
          ),
          viewRoute(target.path, viewport, "light"),
        );
        assert.equal(attribute(link, "role"), undefined);
        for (const child of link.childNodes) {
          assert.equal(
            elements(
              child,
              (node) =>
                ["a", "button", "input", "select", "textarea"].includes(
                  node.tagName,
                ) || attribute(node, "tabindex") !== undefined,
            ).length,
            0,
          );
        }
      }
      if (!entry.path.startsWith("design/components/"))
        assert.equal(
          elements(
            document,
            (node) =>
              (node.tagName === "button" &&
                attribute(node, "class") !== "mbk-nav-variants-toggle") ||
              (node.tagName !== "a" &&
                attribute(node, "tabindex") !== undefined),
          ).length,
          0,
          `${entry.path}: misleading keyboard control`,
        );
    }
  }
});

test("no design route doubles as a directory holding another design route", async () => {
  const entries = await designEntries(
    (entry): entry is ManifestScreen =>
      entry.kind === "screen" && entry.path.startsWith("design/"),
    "design directory routes",
  );
  const routes = entries.map((entry) => entryRoute(entry.path));
  const directories = new Set(
    routes.flatMap((route) => {
      const segments = route.split("/").slice(0, -1);
      return segments.map((_, index) => segments.slice(0, index + 1).join("/"));
    }),
  );
  for (const route of routes)
    assert.ok(
      !directories.has(route.replace(/\.html$/, "")),
      `${route} collides with a route directory segment of the same name`,
    );
});
