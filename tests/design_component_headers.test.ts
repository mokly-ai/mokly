import assert from "node:assert/strict";
import { test } from "node:test";

import {
  COMPONENT_PAGES,
  CONTROLS_PAGES,
} from "../examples/basic/specs/design/components/parts/destinations.js";

import {
  byClass,
  designDocument,
  textContent,
} from "./helpers/design_catalogue.js";
import { headTitle } from "./helpers/design_rows.js";

interface ComponentHeaderExpectation {
  detailsTitle: string;
  heading: string;
  path: string;
  parent?: string;
  status: "Added" | "Changed" | "Removed" | "Unmodified";
}

function assertComponentHeader(
  document: Awaited<ReturnType<typeof designDocument>>["document"],
  expected: ComponentHeaderExpectation,
  id: string,
) {
  assert.equal(headTitle(document), expected.heading, id);
  assert.equal(
    textContent(byClass(document, "mbk-pathchip")[0]!).trim(),
    expected.path,
    id,
  );
  const heads = byClass(document, "mbk-screen-head");
  assert.equal(heads.length, 1, id);
  const statuses = byClass(heads[0]!, "ce-change-status");
  assert.equal(statuses.length, 1, id);
  assert.equal(textContent(statuses[0]!).trim(), expected.status, id);
  const inspector = byClass(document, "ce-inspector")[0];
  assert.ok(inspector, `${id}: missing inspector`);
  const details = textContent(inspector);
  assert.ok(details.includes(`About ${expected.detailsTitle}`), id);
  assert.ok(details.includes(`Path ${expected.path}`), id);
  if (expected.parent === undefined) assert.doesNotMatch(details, /Variant of/);
  else assert.ok(details.includes(`Variant of${expected.parent}`), id);
}

/** Each page: design, heading, path below `example/components`, status, Details title, parent. */
const componentPageHeaders = [
  [COMPONENT_PAGES.default, "Action", "action", "Unmodified", "Action"],
  [
    COMPONENT_PAGES.disabled,
    "Action",
    "action/disabled",
    "Unmodified",
    "Disabled",
    "Action",
  ],
  [
    COMPONENT_PAGES.comparison,
    "Action",
    "action/default",
    "Changed",
    "Default",
    "Action",
  ],
  [
    COMPONENT_PAGES.overlay,
    "Action",
    "action/default",
    "Changed",
    "Default",
    "Action",
  ],
  [
    COMPONENT_PAGES.difference,
    "Action",
    "action/default",
    "Changed",
    "Default",
    "Action",
  ],
  [
    COMPONENT_PAGES["overlay-tall"],
    "Checklist",
    "checklist/default",
    "Changed",
    "Default",
    "Checklist",
  ],
  [
    COMPONENT_PAGES.affected,
    "Action",
    "action/default",
    "Changed",
    "Default",
    "Action",
  ],
  [COMPONENT_PAGES.toolbar, "Toolbar", "toolbar", "Unmodified", "Toolbar"],
  [COMPONENT_PAGES.hidden, "Help hint", "help-hint", "Unmodified", "Help hint"],
  [COMPONENT_PAGES.unused, "Badge", "badge", "Unmodified", "Badge"],
  [
    COMPONENT_PAGES.added,
    "Badge",
    "badge/default",
    "Added",
    "Default",
    "Badge",
  ],
  [
    COMPONENT_PAGES.removed,
    "Action",
    "action/compact",
    "Removed",
    "Compact",
    "Action",
  ],
  [
    COMPONENT_PAGES["shared-impact"],
    "Action",
    "action",
    "Unmodified",
    "Action",
  ],
  [COMPONENT_PAGES.closed, "Action", "action", "Unmodified", "Action"],
] as const;

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: empty inspection keeps Unmodified in its screen head`, async () => {
    const { document } = await designDocument(
      "design/components/states/empty",
      viewport,
    );
    const heads = byClass(document, "mbk-screen-head");
    assert.equal(heads.length, 1);
    assert.match(textContent(heads[0]!), /Unmodified/u);
  });
  test(`${viewport}: component page headers and Details describe the shown entry`, async () => {
    for (const [
      id,
      heading,
      entryPath,
      status,
      detailsTitle,
      parent,
    ] of componentPageHeaders) {
      const { document } = await designDocument(id, viewport);
      assertComponentHeader(
        document,
        {
          detailsTitle,
          heading,
          path: `example/components/${entryPath}`,
          ...(parent === undefined ? {} : { parent }),
          status,
        },
        id,
      );
    }
  });

  test(`${viewport}: controls pages identify their selected component variant`, async () => {
    for (const [state, id] of Object.entries(CONTROLS_PAGES)) {
      const disabled = state === "variant" || state === "readonly-variant";
      const { document } = await designDocument(id, viewport);
      assertComponentHeader(
        document,
        {
          detailsTitle: disabled ? "Disabled" : "Default",
          heading: "Action",
          path: disabled
            ? "example/components/action/disabled"
            : "example/components/action/default",
          parent: "Action",
          status: state === "comparison" ? "Changed" : "Unmodified",
        },
        id,
      );
    }
  });

  test(`${viewport}: independently changed and removed screens show their own status`, async () => {
    for (const [id, status] of [
      ["design/components/inspection/inspection-direct-change", "Changed"],
      ["design/components/states/removed-consumer", "Removed"],
    ] as const) {
      const { document } = await designDocument(id, viewport);
      const heading = byClass(document, "mbk-screen-head")[0]!;
      assert.deepEqual(
        byClass(heading, "ce-change-status").map(textContent),
        [status],
        id,
      );
    }
  });
}
