import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import type {
  EntryDefinition,
  ResolvedRegistryEntry,
  ScreenDefinition,
  ScreenInput,
  UseCaseInput,
} from "../dist/authoring/types.js";
import {
  defineComponent,
  definePage,
  defineScreen,
  defineUseCase,
} from "../dist/index.js";
import { validateEntry } from "../dist/registry/entry_validation.js";
import type { RegistryViolation } from "../dist/registry/prepared_types.js";
import { entryRoute } from "../packages/viewer/dist/data.js";

import { repositoryRoot } from "./helpers/fixture.js";
import { registryValidationConfig } from "./helpers/registry_validation.js";

const sourceRelativePath = "tests/authoring.test.tsx";

const validationConfig = registryValidationConfig(sourceRelativePath);

const screenBase = {
  slug: "tagged-screen",
  dependencies: [],
  description: "Tagged screen",
  desktop: "Desktop",
  path: "tagged-screen",
  mobile: "Mobile",
  relatedDocs: [],
  title: "Tagged screen",
} satisfies ScreenInput;

const useCaseBase: UseCaseInput = {
  dependencies: [],
  description: "Tagged journey",
  path: "tagged-journey",
  relatedDocs: [],
  steps: [{ screenPath: "tagged-screen" }],
  title: "Tagged journey",
};

test("definitions keep identity while shared helpers derive every document", () => {
  const screenDefinition = defineScreen(screenBase);
  const pageDefinition = definePage({
    dependencies: [],
    description: "Account guide",
    path: "account-guide",
    relatedDocs: [],
    render: () => "<html><body>Guide</body></html>",
    title: "Account guide",
  });
  const useCaseDefinition = defineUseCase(useCaseBase);
  const componentDefinition = defineComponent({
    dependencies: [],
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

test("empty tags are valid and equivalent to absent tags", () => {
  const empty = defineScreen({ ...screenBase, tags: [] });

  assert.deepEqual(empty.tags, []);
  assert.deepEqual(validateEntry(resolved(empty), validationConfig), []);
  assert.deepEqual(
    validateEntry(resolved(defineScreen(screenBase)), validationConfig),
    [],
  );
});

test("entry validation rejects Windows device names without changing tag grammar", () => {
  const definition = defineScreen({ ...screenBase, path: "con" });
  assert.deepEqual(validateEntry(resolved(definition), validationConfig), [
    {
      code: "invalid-path",
      path: "con",
      message: "path must be a valid catalogue path",
      sourceRelativePath,
    },
  ]);
  assert.deepEqual(tagViolations(["con"]), []);
});

function tagViolations(tags: unknown): RegistryViolation[] {
  const input = { ...screenBase, tags } as ScreenInput;
  return validateEntry(
    resolved(singleDefinition(defineScreen(input))),
    validationConfig,
  );
}

function useCaseTagViolations(tags: unknown): RegistryViolation[] {
  const input = { ...useCaseBase, tags } as UseCaseInput;
  return validateEntry(resolved(defineUseCase(input)), validationConfig);
}

function tagProblem(message: string, id = "tagged-screen"): RegistryViolation {
  return { code: "invalid-tags", path: id, message, sourceRelativePath };
}

function resolved(definition: EntryDefinition): ResolvedRegistryEntry {
  return {
    ...definition,
    path: definition.path!,
    slug: definition.slug ?? definition.path!,
    index: false,
    linkBase: "",
    location: sourceRelativePath,
    sourcePath: path.join(repositoryRoot, sourceRelativePath),
    sourceRelativePath,
  };
}

function singleDefinition(
  definition: ScreenDefinition | readonly ScreenDefinition[],
): ScreenDefinition {
  if (!("kind" in definition)) throw new Error("expected one screen");
  return definition;
}
