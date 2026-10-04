import assert from "node:assert/strict";
import { test } from "node:test";

import {
  attribute,
  byClass,
  designCatalogue,
  designDocument,
  elements,
  textContent,
  type Element,
} from "./helpers/design_catalogue.js";
import { stylesheetGroups } from "./helpers/design_evidence.js";
import { navRows } from "./helpers/design_rows.js";
import {
  comparison,
  hasClass,
  openPanel,
  previews,
} from "./helpers/design_stacks.js";

const STYLED = "design-component-style-changed";
const OUTSIDE = "design-component-style-outside";
const EXCLUDED = "design-component-shared-impact";
const GALLERY = [
  "Design",
  "Mokly design",
  "Component explorer",
  "Empty and change states",
  "Stylesheet evidence",
];
const ACTION_VARIANTS = ["Default", "Disabled", "Secondary"];

type Document = Awaited<ReturnType<typeof designDocument>>["document"];

/** The Changes count a reader sees: the filter on desktop, the shortcut on mobile. */
function changesShortcut(document: Document, viewport: string) {
  if (viewport === "desktop")
    return [
      byClass(document, "mbk-nav-filter-opt")
        .filter((node) => hasClass(node, "active"))
        .map((node) => textContent(node).trim()),
      textContent(byClass(document, "mbk-nav-filter-count")[0]!),
    ];
  const [location] = byClass(document, "ce-mobile-location");
  assert.ok(location);
  const changes = elements(location, (node) =>
    textContent(node).startsWith("Changes"),
  ).find((node) => node.tagName === "a" || node.tagName === "span");
  assert.ok(changes);
  return [
    changes.tagName === "a" ? attribute(changes, "data-mokly-link") : "none",
    textContent(byClass(changes, "ce-change-count")[0]!),
  ];
}

/** The comparison details section and its labelled rows. */
function evidence(document: Document, where: string) {
  const [section, ...others] = byClass(document, "ce-comparison-evidence");
  assert.ok(section, where);
  assert.equal(others.length, 0, where);
  const rows = new Map(
    elements(section, (node) => node.tagName === "div").flatMap((row) => {
      const [term] = elements(row, (node) => node.tagName === "dt");
      const [value] = elements(row, (node) => node.tagName === "dd");
      return term && value
        ? [[textContent(term).trim(), textContent(value).trim()] as const]
        : [];
    }),
  );
  return { rows, section, text: textContent(section) };
}

function toolbarState(document: Document) {
  const [toolbar] = byClass(document, "mbk-cmp-toolbar");
  assert.ok(toolbar);
  return {
    links: elements(toolbar, (node) => node.tagName === "a").length,
    pressed: elements(
      toolbar,
      (node: Element) =>
        node.tagName === "button" && attribute(node, "aria-pressed") === "true",
    ).map((node) => textContent(node).trim()),
  };
}

test("the stylesheet evidence gallery holds three component stylesheet stories", async () => {
  const { manifest } = await designCatalogue;
  const gallery = manifest.entries.filter(
    (entry) =>
      entry.kind === "screen" &&
      entry.navPath.join(" › ") === GALLERY.join(" › "),
  );
  assert.deepEqual(gallery.map((entry) => [entry.id, entry.title]).sort(), [
    [EXCLUDED, "Component with excluded styles"],
    [STYLED, "Component with changed styles"],
    [OUTSIDE, "Styles outside a changed component"],
  ]);
  for (const entry of gallery)
    if (entry.kind === "screen")
      assert.deepEqual(entry.colorSchemes, ["light"], entry.id);
});

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: a component changed by its own styles lists its consumers as affected`, async () => {
    const { document, route } = await designDocument(STYLED, viewport);
    assert.equal(textContent(byClass(document, "mbk-idchip")[0]!), "#action");
    assert.deepEqual(
      byClass(document, "ce-change-status").map((node) => textContent(node)),
      ["Changed"],
    );
    const about = textContent(byClass(document, "ce-inspector")[0]!);
    assert.ok(about.includes("About Action"), route);
    assert.doesNotMatch(about, /Variant of/, route);
    assert.equal(openPanel(document), "usage", route);
    const affected = elements(
      document,
      (node) => attribute(node, "aria-label") === "Affected screens",
    )[0];
    assert.ok(affected, route);
    assert.deepEqual(
      elements(affected, (node) => node.tagName === "a").map((link) => [
        textContent(link).replace("↗", "").trim(),
        attribute(link, "data-mokly-link"),
      ]),
      [
        ["Welcome", "design-component-inspection-details"],
        ["Details", "design-component-inspection-consumer"],
      ],
    );
    if (viewport === "desktop") {
      assert.deepEqual(navRows(document, "pages"), [], "no screen rows");
      assert.deepEqual(navRows(document, "components"), [
        ["Components", false, undefined, undefined],
        ["Action", true, STYLED, "page"],
        ...ACTION_VARIANTS.map((label) => [label, true, undefined, undefined]),
      ]);
    }
    assert.deepEqual(
      changesShortcut(document, viewport),
      viewport === "desktop" ? [["Changes4"], "4"] : [STYLED, "4"],
    );
    assert.deepEqual(toolbarState(document), {
      links: 0,
      pressed: ["Side by side"],
    });
    for (const [where, preview] of previews(document))
      assert.equal(
        comparison(preview, `${route} ${where}`).caption,
        "Default variant · Styles this variant uses changed",
      );
    const details = evidence(document, route);
    assert.deepEqual(
      [...details.rows],
      [
        ["Change", "Styles this variant uses changed"],
        ["Saved variant", "Default"],
        ["Saved props", "Unchanged"],
      ],
    );
    assert.deepEqual(stylesheetGroups(details.section, route), {
      lead: "Changes to these files may affect this component:",
      files: [
        [
          "styles/actions.css",
          [["Changed styles that apply to this component:", [".action"]]],
        ],
      ],
    });
    assert.doesNotMatch(details.text, /outside the changed components/);
  });

  test(`${viewport}: a changed style outside the changed component gives the screen its own row`, async () => {
    const { document, route } = await designDocument(OUTSIDE, viewport);
    assert.equal(
      textContent(byClass(document, "mbk-idchip")[0]!),
      "#example-welcome",
    );
    assert.deepEqual(
      byClass(document, "ce-change-status").map((node) => textContent(node)),
      ["Changed"],
    );
    assert.equal(openPanel(document), "info", route);
    if (viewport === "desktop") {
      assert.deepEqual(navRows(document, "pages"), [
        ["Screens", false, undefined, undefined],
        ["Welcome", true, OUTSIDE, "page"],
      ]);
      assert.deepEqual(navRows(document, "components"), [
        ["Components", false, undefined, undefined],
        ["Action", true, STYLED, undefined],
        ...ACTION_VARIANTS.map((label) => [label, true, undefined, undefined]),
      ]);
    }
    assert.deepEqual(
      changesShortcut(document, viewport),
      viewport === "desktop" ? [["Changes5"], "5"] : [OUTSIDE, "5"],
    );
    assert.deepEqual(toolbarState(document), {
      links: 0,
      pressed: ["Current"],
    });
    for (const [where, preview] of previews(document)) {
      const outside = byClass(preview, "ce-outside-action");
      assert.deepEqual(outside.map(textContent), ["Not now"], where);
      assert.equal(outside[0]!.tagName, "span", where);
    }
    const details = evidence(document, route);
    assert.deepEqual(
      [...details.rows],
      [["Change", "Styles this screen uses changed"]],
    );
    assert.deepEqual(stylesheetGroups(details.section, route), {
      lead: "Changes to these files may affect this screen:",
      files: [
        [
          "styles/actions.css",
          [
            [
              "These changed styles also apply outside the changed components on this screen:",
              [".action"],
            ],
          ],
        ],
      ],
    });
    assert.deepEqual(
      elements(details.section, (node) => node.tagName === "a").map((link) => [
        textContent(link).trim(),
        attribute(link, "data-mokly-link"),
      ]),
      [["Action", STYLED]],
    );
    for (const heading of elements(document, (node) =>
      ["h1", "h2", "h3", "h4"].includes(node.tagName),
    ))
      assert.doesNotMatch(textContent(heading), /\.action|actions\.css/);
  });

  test(`${viewport}: an excluded stylesheet leaves Action out of Changes, opened from All`, async () => {
    const { document, route } = await designDocument(EXCLUDED, viewport);
    assert.deepEqual(
      byClass(document, "ce-change-status").map((node) => textContent(node)),
      ["Unmodified"],
    );
    assert.equal(byClass(document, "mbk-cmp-toolbar").length, 0, route);
    assert.equal(byClass(document, "mbk-nav-changed").length, 0, route);
    assert.deepEqual(
      changesShortcut(document, viewport),
      viewport === "desktop" ? [["All"], "0"] : ["none", "0"],
    );
    const { text } = evidence(document, route);
    assert.match(
      text,
      /This stylesheet changed, but none of the changed styles apply to this variant\./,
    );
    assert.match(text, /styles\/actions\.css/);
    assert.match(text, /No changes to this saved view\./);
  });
}
