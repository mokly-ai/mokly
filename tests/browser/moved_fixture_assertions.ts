import { expect, type APIRequestContext } from "@playwright/test";

import { readEntryDetail } from "../../packages/viewer/src/catalogue/detail_reader.js";
import { movedFixturePaths as paths } from "../helpers/moved_fixture_sources.js";

/** Nested slot inputs stay with the moved variant and retain both saved values. */
export async function expectMovedInputs(
  request: APIRequestContext,
  origin: string,
): Promise<void> {
  const response = await request.get(
    `${origin}/mokly-viewer/entries/${paths.nestedMovedVariant}.json`,
  );
  expect(response.ok()).toBe(true);
  const detail = readEntryDetail(await response.json());
  expect(detail.workspace!.inputChanges).toEqual(
    ["mobile", "desktop"].flatMap((viewport) =>
      ["light", "dark"].map((colorScheme) => ({
        instanceId: "glyph",
        title: "Icon",
        viewport,
        colorScheme,
        variantPath: paths.nestedMovedVariant,
        before: { name: ["string", "arrow"] },
        after: { name: ["string", "chevron"] },
      })),
    ),
  );
}
