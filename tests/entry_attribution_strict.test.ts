import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("registry attribution does not trust an uninventoried path under an entry root", async (context) => {
  const fixture = await createFixture(`
import { defineScreen } from "@mokly/mokly";
const forged = defineScreen({
  dependencies: [],
  description: "Forged source",
  desktop: "Forged",
  id: "forged",
  mobile: "Forged",
  relatedDocs: [],
  route: "forged.html",
  title: "Forged",
  useCaseIds: []
});
forged.definedIn = "entries/not-imported.ts";
export const mockups = [forged];
`);
  context.after(() => removeFixture(fixture));

  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    /invalid-source[\s\S]*not attributed to a resolved entry module or inventoried source/,
  );
});
