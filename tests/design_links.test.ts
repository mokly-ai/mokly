import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import {
  attribute,
  byClass,
  designCatalogue,
  designDocument,
  elements,
  textContent,
} from "./helpers/design_catalogue.js";

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: design actions navigate to the subject's owning screen`, async () => {
    for (const [source, className, targets] of [
      ["design-browse-home", "mbk-empty-link", ["design-browse-screen"]],
      ["design-browse-missing-route", "mbk-empty-link", ["design-browse-home"]],
      [
        "design-browse-screen",
        "mbk-shot-link",
        ["design-browse-details-screen"],
      ],
      [
        "design-browse-details-screen",
        "mbk-shot-link",
        ["design-browse-screen"],
      ],
      [
        "design-browse-use-case",
        "flow-step-link",
        ["design-browse-screen", "design-browse-details-screen"],
      ],
      ["design-browse-details", "flow", ["design-browse-use-case"]],
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
    const removed = await designDocument("design-review-removed", viewport);
    assert.equal(byClass(removed.document, "mbk-shot-link").length, 0);
    assert.equal(byClass(removed.document, "mbk-empty-link").length, 0);
  });

  test(`${viewport}: navigation chrome uses explicit leaves and canonical recovery`, async () => {
    const { document } = await designDocument(
      "design-browse-navigation",
      viewport,
    );
    assert.equal(
      attribute(byClass(document, "mbk-brand")[0]!, "data-mokly-link"),
      "design-browse-home",
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
        ["Welcome", "design-browse-screen"],
        ["Details", "design-browse-details-screen"],
        ["Example tour", "design-browse-use-case"],
        ["Action", "design-component-overview"],
        ["Toolbar", "design-component-toolbar"],
      ],
    );
    assert.equal(
      attribute(byClass(document, "mbk-menu-btn")[0]!, "data-mokly-link"),
      "design-browse-home",
    );
    assert.match(
      attribute(byClass(document, "mbk-menu-btn")[0]!, "aria-label") ?? "",
      /Close/,
    );
    if (viewport === "mobile") {
      const home = await designDocument("design-browse-home", viewport);
      assert.equal(
        attribute(
          byClass(home.document, "mbk-menu-btn")[0]!,
          "data-mokly-link",
        ),
        "design-browse-navigation",
      );
    }
  });
}

test("every design link resolves to a real same-viewport design artifact without scripts or nested controls", async () => {
  const { manifest } = await designCatalogue;
  const designs = manifest.entries.filter(
    (entry) => entry.kind === "screen" && entry.id.startsWith("design-"),
  );
  const componentDesigns = designs.filter((entry) =>
    entry.id.startsWith("design-component-"),
  );
  assert.equal(componentDesigns.length, 32);
  assert.equal(designs.length - componentDesigns.length, 60);
  for (const entry of designs) {
    for (const viewport of ["mobile", "desktop"] as const) {
      const { document, route } = await designDocument(entry.id, viewport);
      const links = elements(document, (node) => node.tagName === "a");
      assert.ok(links.length > 0, entry.id);
      assert.equal(
        elements(document, (node) => node.tagName === "script").length,
        0,
      );
      for (const link of links) {
        const id = attribute(link, "data-mokly-link");
        const target = designs.find((entry) => entry.id === id);
        assert.ok(
          target?.kind === "screen",
          `${entry.id}: invalid target ${id}`,
        );
        const href = attribute(link, "href");
        assert.ok(href);
        assert.equal(
          path.posix.normalize(
            path.posix.join(path.posix.dirname(route), href),
          ),
          target.fragments[viewport],
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
      if (!entry.id.startsWith("design-component-"))
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
          `${entry.id}: misleading keyboard control`,
        );
    }
  }
});
