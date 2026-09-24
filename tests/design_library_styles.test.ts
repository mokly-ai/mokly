import assert from "node:assert/strict";
import test from "node:test";

import { designCatalogue } from "./helpers/design_catalogue.js";
import { textOutput } from "./helpers/generated_text.js";

test("standalone variants emit only the exclusive child styles they actually render", async () => {
  const { manifest, outputs } = await designCatalogue;
  const entry = manifest.entries.find(
    (entry) => entry.id === "design-ui-top-bar",
  );
  assert.ok(entry?.kind === "component");
  for (const viewport of ["mobile", "desktop"] as const) {
    const closed = textOutput(
      outputs,
      entry.variants.find((variant) => variant.id === "default")!.fragments[
        viewport
      ],
    )!;
    const opened = textOutput(
      outputs,
      entry.variants.find((variant) => variant.id === "tag-picker")!.fragments[
        viewport
      ],
    )!;
    assert.match(closed, /href="[^"]*design-library\/chrome\/top-bar\.css"/);
    assert.doesNotMatch(
      closed,
      /href="[^"]*design-library\/controls\/tag-(chip|picker)\.css"/,
    );
    assert.match(
      opened,
      /href="[^"]*design-library\/controls\/tag-picker\.css"/,
    );
    assert.match(opened, /href="[^"]*design-library\/controls\/tag-chip\.css"/);
  }
  const picker = manifest.entries.find(
    (entry) => entry.id === "design-ui-tag-picker",
  );
  assert.ok(picker?.kind === "component");
  const empty = picker.variants.find((variant) => variant.id === "empty")!;
  for (const route of Object.values(empty.fragments))
    assert.doesNotMatch(
      textOutput(outputs, route)!,
      /href="[^"]*design-library\/controls\/tag-chip\.css"/,
    );
});

test("ownership includes implementation and CSS, while variants stay outside impact dependencies", async () => {
  const { manifest } = await designCatalogue;
  for (const entry of manifest.entries) {
    if (entry.kind !== "component" || !entry.id.startsWith("design-ui-"))
      continue;
    const slug = entry.id.slice("design-ui-".length);
    assert.ok(
      entry.ownedDependencies.some((file) =>
        file.endsWith("/" + slug + ".css"),
      ),
      entry.id,
    );
    assert.ok(
      entry.ownedDependencies.some((file) =>
        file.endsWith("/" + slug + ".view.tsx"),
      ),
      entry.id,
    );
    assert.ok(
      !entry.declaredDependencies.some((file) =>
        file.endsWith("/" + slug + ".tsx"),
      ),
      entry.id,
    );
    assert.ok(
      entry.ownedDependencies.every((file) =>
        entry.declaredDependencies.includes(file),
      ),
      entry.id,
    );
  }
});
