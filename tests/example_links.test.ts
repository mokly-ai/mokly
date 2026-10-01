import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import { parse } from "parse5";

import { viewRoute } from "../packages/viewer/dist/data.js";

import {
  attribute,
  designCatalogue,
  elements,
  textContent,
} from "./helpers/design_catalogue.js";

for (const viewport of ["mobile", "desktop"] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test(`${viewport}/${scheme}: real example buttons are styled portable links with the promised anchors`, async () => {
      const { manifest, outputs } = await designCatalogue;
      for (const [source, target, label, fragment] of [
        ["example-welcome", "example-details", "View details", "details"],
        ["example-details", "example-welcome", "Return to welcome", undefined],
      ] as const) {
        const entry = manifest.entries.find((entry) => entry.id === source);
        const destination = manifest.entries.find(
          (entry) => entry.id === target,
        );
        assert.ok(entry?.kind === "screen" && destination?.kind === "screen");
        const route = entry.colorSchemes.includes(scheme)
          ? viewRoute("screen", entry.id, viewport, scheme)
          : undefined;
        const targetRoute = destination.colorSchemes.includes(scheme)
          ? viewRoute("screen", destination.id, viewport, scheme)
          : undefined;
        assert.ok(route && targetRoute);
        const document = parse(outputs.get(route) ?? "");
        const link = elements(
          document,
          (node) =>
            textContent(node).trim() === label &&
            attribute(node, "data-mokly-link-control") !== undefined,
        )[0];
        assert.ok(link, `${source}: missing styled ${label} link`);
        assert.equal(link.tagName, "a");
        assert.equal(attribute(link, "role"), undefined);
        assert.equal(attribute(link, "aria-disabled"), undefined);
        assert.equal(
          attribute(link, "data-mokly-link"),
          target + (fragment ? `#${fragment}` : ""),
        );
        const href = attribute(link, "href");
        assert.ok(href);
        assert.equal(
          path.posix.normalize(
            path.posix.join(path.posix.dirname(route), href),
          ),
          targetRoute + (fragment ? `#${fragment}` : ""),
        );
        assert.equal(
          elements(document, (node) => node.tagName === "a").length,
          source === "example-welcome" ? 7 : 4,
        );
        for (const [title, id] of [
          ["Browse details", "example-details#details"],
          ["Browse welcome", "example-welcome"],
        ]) {
          const nested = elements(
            document,
            (node) =>
              node.tagName === "a" && textContent(node).trim() === title,
          );
          assert.equal(nested.length, 1);
          assert.equal(attribute(nested[0]!, "data-mokly-link"), id);
        }
        if (fragment)
          assert.ok(
            elements(
              parse(outputs.get(targetRoute) ?? ""),
              (node) => attribute(node, "id") === fragment,
            ).length,
          );
      }
    });
  }
}
