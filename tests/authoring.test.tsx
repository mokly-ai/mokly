import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import {
  defineComponent,
  definePage,
  defineScreen,
  defineUseCase,
  MockLink,
  ReviewIgnore,
  ReviewIgnoreScope,
  reviewMaterialKey,
} from "../dist/index.js";
import { validateEntry } from "../dist/registry/entry_validation.js";
import { serializeReviewSentinels } from "../dist/renderer/sentinels.js";
import { entryRoute } from "../packages/viewer/dist/data.js";

import {
  resolved,
  screenBase,
  tagProblem,
  tagViolations,
  useCaseBase,
  useCaseTagViolations,
  validationConfig,
} from "./authoring_fixture.js";

test("ReviewIgnore serializes to inert paired comments", () => {
  const key = reviewMaterialKey({ current: "home" });
  const html = serializeReviewSentinels(
    renderToStaticMarkup(
      <ReviewIgnore id="shared-nav" materialKey={key}>
        <nav>Navigation</nav>
      </ReviewIgnore>,
    ),
  );
  assert.match(html, /<!--mokly-review-ignore:start:shared-nav-->/);
  assert.match(html, /<!--mokly-review-ignore:end:shared-nav-->/);
  assert.match(html, /<!--mokly-review-material:shared-nav:[a-f0-9]{64}-->/);
});

test("MockLink keeps fragment identity out of rendered package props", () => {
  const html = renderToStaticMarkup(
    <MockLink className="details-link" fragment="billing-section" to="details">
      Details
    </MockLink>,
  );

  assert.equal(
    html,
    '<a class="details-link" href="mock:details#billing-section">Details</a>',
  );
  assert.doesNotMatch(html, /fragment=/);
  assert.throws(
    () => renderToStaticMarkup(<MockLink to="details#billing">Bad</MockLink>),
    /expected a complete path/,
  );
});

test("ReviewIgnoreScope can render children with no marker contract", () => {
  const html = renderToStaticMarkup(
    <ReviewIgnoreScope enabled={false}>
      <ReviewIgnore id="shared-nav">
        <nav>Navigation</nav>
      </ReviewIgnore>
    </ReviewIgnoreScope>,
  );
  assert.equal(html, "<nav>Navigation</nav>");
});

test("review material keys reject cyclic or non-finite state", () => {
  const cyclic: { self?: object } = {};
  cyclic.self = cyclic;
  assert.throws(() => reviewMaterialKey(cyclic), /cyclic/);
  assert.throws(() => reviewMaterialKey({ value: Number.NaN }), /finite/);
});

test("definitions keep identity while shared helpers derive every document", () => {
  const screenDefinition = defineScreen(screenBase);
  const pageDefinition = definePage({
    description: "Account guide",
    path: "account-guide",
    relatedDocs: [],
    render: () => "<html><body>Guide</body></html>",
    title: "Account guide",
  });
  const useCaseDefinition = defineUseCase(useCaseBase);
  const componentDefinition = defineComponent({
    description: "Action",
    path: "action",
    propSchema: { kind: "object", properties: {} },
    relatedDocs: [],
    render: () => "Action",
    title: "Action",
    variants: [
      {
        slug: "default",

        props: {},
        title: "Default",
      },
    ],
  }).entries[0];

  for (const definition of [
    screenDefinition,
    pageDefinition,
    useCaseDefinition,
    componentDefinition,
  ])
    assert.equal(Object.hasOwn(definition, "route"), false);
  assert.equal(entryRoute(screenDefinition.path!), "tagged-screen/index.html");
  assert.equal(entryRoute(pageDefinition.path!), "account-guide/index.html");
  assert.equal(
    entryRoute(useCaseDefinition.path!),
    "tagged-journey/index.html",
  );
  assert.equal(entryRoute(componentDefinition.path!), "action/index.html");
});

test("defineScreen flattens declared variants after their parent", () => {
  const definitions = defineScreen({
    ...screenBase,
    variants: [
      {
        slug: "empty",
        description: "Empty tagged screen",
        desktop: "Empty desktop",

        mobile: "Empty mobile",
        title: "Tagged screen, empty",
      },
    ],
  });

  assert.equal(definitions[0]?.path, "tagged-screen");
  assert.equal(definitions[1]?.slug, "empty");
  assert.equal(definitions[1]?.path, undefined);
});

test("define helpers keep authored tags on screens and use cases", () => {
  const definition = defineScreen({
    ...screenBase,
    tags: ["forms", "onboarding"],
  });
  const useCase = defineUseCase({ ...useCaseBase, tags: ["forms"] });

  assert.deepEqual(definition.tags, ["forms", "onboarding"]);
  assert.deepEqual(useCase.tags, ["forms"]);
});

test("entry validation rejects tags outside the catalogue-id grammar", () => {
  for (const tags of [
    "forms",
    ["forms", "Forms!"],
    ["forms", "for ms"],
    ["forms", ""],
    ["forms", 1],
  ]) {
    assert.deepEqual(tagViolations(tags), [
      tagProblem("tags must be an array of lowercase kebab-case strings"),
    ]);
  }
  assert.deepEqual(tagViolations(["forms", "forms"]), [
    tagProblem("tags must not contain duplicates"),
  ]);
});

test("entry validation accepts declared tags on screens and use cases", () => {
  assert.deepEqual(
    validateEntry(
      resolved(defineScreen({ ...screenBase, tags: ["forms", "onboarding"] })),
      validationConfig,
    ),
    [],
  );
  assert.deepEqual(useCaseTagViolations(["forms", "onboarding"]), []);
  assert.deepEqual(useCaseTagViolations(["forms", "Forms!"]), [
    tagProblem(
      "tags must be an array of lowercase kebab-case strings",
      "tagged-journey",
    ),
  ]);
});
