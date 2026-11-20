import { test } from "./harness";
import { expectIdentifierFieldPolicy } from "./identifier-field-support";

test("identifier fields prevent keyboard rewriting on desktop", async ({
  page,
}) => {
  await expectIdentifierFieldPolicy(page, "desktop");
});
