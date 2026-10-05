import assert from "node:assert/strict";
import { test } from "node:test";

import { adoptedViewerCatalogue } from "../src/shell/capability_adoption.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { viewerCatalogue } from "../src/viewer/projection.js";

import {
  capabilitySource,
  viewerRevision,
} from "./capability_adoption_fixture.js";
import { componentWorkspaceFixture } from "./component_workspace_fixture.js";
import {
  CHANGED,
  CHANGED_SECTION,
  published,
  renderPage,
  section,
  status,
} from "./page_evidence_fixture.js";

const { model: fixture } = componentWorkspaceFixture();

test("live evidence replaces a document page's status and Details in place", () => {
  const current = viewerCatalogue(fixture);
  const route = routeFromUrl(
    current,
    new URL("https://example.test/view/guide/"),
  );
  assert.equal(route.view.kind, "target");
  const changed = published({
    changes: { status: "ready", kind: "changed", included: true },
    resourceEvidence: CHANGED,
  });
  const revision = viewerRevision(
    {
      ...changed,
      revision: {
        ...changed.revision,
        evidence: changed.revision.evidence + 1,
      },
    },
    capabilitySource(fixture, 4),
    route,
  );
  assert.equal(revision.workspace, undefined, "a page owns no workspace");
  const next = adoptedViewerCatalogue(
    current,
    capabilitySource(fixture, 4),
    route,
    revision,
  );
  assert.ok(next);

  const before = renderPage(current);
  assert.deepEqual(status(before), ["Unmodified"]);
  assert.match(section(before) ?? "", /<p>No changes to this page\.<\/p>/);
  const after = renderPage(next);
  assert.deepEqual(status(after), ["Changed"]);
  assert.equal(section(after), CHANGED_SECTION);
});
