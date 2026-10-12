import assert from "node:assert/strict";
import test from "node:test";

import { textOutput } from "./helpers/generated_text.js";
import { pathFixture, pageSource } from "./helpers/path_fixture.js";

const metadata = "title:'Invoice',description:'Invoice state',relatedDocs:[]";

test("index, ordinary, variant and declared paths share the resolved link-base rule", async (t) => {
  const fixture = await pathFixture({
    "specs/account/index.mockup.ts": pageSource(
      "",
      '<html><body><a href="mock:./billing/payment-methods">Payments</a></body></html>',
    ),
    "specs/account/billing/payment-methods.mockup.ts": pageSource(),
    "specs/account/billing/invoice.mockup.tsx": `import {defineScreen,MockLink} from '@mokly/mokly'; export default defineScreen({${metadata},mobile:<MockLink to='./payment-methods'>Payments</MockLink>,desktop:'Invoice',variants:[{slug:'overdue',title:'Overdue',description:'Overdue invoice',mobile:<MockLink to='./payment-methods'>Payments</MockLink>,desktop:'Overdue'}]});`,
    "specs/elsewhere.mockup.ts": pageSource(
      'path:"account/billing/declared",',
      '<html><body><a href="mock:./payment-methods">Payments</a></body></html>',
    ),
  });
  t.after(fixture.remove);
  const result = await fixture.compile();
  for (const route of [
    "account/index.html",
    "account/billing/invoice/index.mobile.html",
    "account/billing/invoice/overdue/index.mobile.html",
    "account/billing/declared/index.html",
  ])
    assert.match(
      textOutput(result.outputs, route)!,
      /data-mokly-link="account\/billing\/payment-methods"/,
    );
});

test("a variant's reciprocal flow references resolve from the parent's base", async (t) => {
  const fixture = await pathFixture({
    "specs/billing/invoice.mockup.tsx": `import {defineScreen} from '@mokly/mokly'; export default defineScreen({${metadata},mobile:'Invoice',desktop:'Invoice',variants:[{slug:'overdue',title:'Overdue',description:'Overdue invoice',mobile:'Overdue',desktop:'Overdue',useCasePaths:['./collect']}]});`,
    "specs/billing/collect.mockup.ts": `import {defineUseCase} from '@mokly/mokly'; export default defineUseCase({${metadata},steps:[{screenPath:'./invoice/overdue'}]});`,
  });
  t.after(fixture.remove);
  const entries = (await fixture.compile()).manifest.entries;
  assert.deepEqual(entries.find((entry) => entry.kind === "use-case")?.steps, [
    { screenPath: "billing/invoice/overdue" },
  ]);
  assert.deepEqual(
    entries
      .filter((entry) => entry.kind === "screen")
      .find((entry) => entry.variantOf)?.useCasePaths,
    ["billing/collect"],
  );
});
