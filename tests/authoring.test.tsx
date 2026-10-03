import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import React from "react";

import type {
  RegistryDefinition,
  ResolvedRegistryEntry,
  ScreenDefinition,
  ScreenInput,
  UseCaseInput,
} from "../dist/authoring/types.js";
import {
  defineRoot,
  defineComponent,
  definePage,
  defineScreen,
  defineUseCase,
  screen,
} from "../dist/index.js";
import { validateEntry } from "../dist/registry/entry_validation.js";
import type { RegistryViolation } from "../dist/registry/prepared_types.js";
import { entryRoute } from "../packages/viewer/dist/data.js";

import { repositoryRoot } from "./helpers/fixture.js";
import { registryValidationConfig } from "./helpers/registry_validation.js";

const sourceRelativePath = "tests/authoring.test.tsx";

const validationConfig = registryValidationConfig(sourceRelativePath);

const screenBase = {
  dependencies: [],
  description: "Tagged screen",
  desktop: "Desktop",
  id: "tagged-screen",
  mobile: "Mobile",
  relatedDocs: [],
  title: "Tagged screen",
} satisfies ScreenInput;

const useCaseBase: UseCaseInput = {
  dependencies: [],
  description: "Tagged journey",
  id: "tagged-journey",
  relatedDocs: [],
  steps: [{ screenId: "tagged-screen" }],
  title: "Tagged journey",
};

test("definitions keep identity while shared helpers derive every document", () => {
  const screenDefinition = defineScreen(screenBase);
  const pageDefinition = definePage({
    dependencies: [],
    description: "Account guide",
    id: "account-guide",
    relatedDocs: [],
    render: () => "<html><body>Guide</body></html>",
    title: "Account guide",
  });
  const useCaseDefinition = defineUseCase(useCaseBase);
  const componentDefinition = defineComponent({
    dependencies: [],
    description: "Action",
    id: "action",
    propSchema: { kind: "object", properties: {} },
    relatedDocs: [],
    render: () => "Action",
    title: "Action",
    variants: [{ id: "action-default", props: {}, title: "Default" }],
  }).entries[0];

  for (const definition of [
    screenDefinition,
    pageDefinition,
    useCaseDefinition,
    componentDefinition,
  ])
    assert.equal(Object.hasOwn(definition, "route"), false);
  assert.equal(
    entryRoute(screenDefinition.kind, screenDefinition.id),
    "screens/tagged-screen.html",
  );
  assert.equal(
    entryRoute(pageDefinition.kind, pageDefinition.id),
    "pages/account-guide.html",
  );
  assert.equal(
    entryRoute(useCaseDefinition.kind, useCaseDefinition.id),
    "user-flows/tagged-journey.html",
  );
  assert.equal(
    entryRoute(componentDefinition.kind, componentDefinition.id),
    "components/action.html",
  );
});

test("nested screens retain colorSchemes through root flattening", () => {
  const definitions = defineRoot({
    children: [
      screen({
        colorSchemes: ["light"],
        description: "Light-only nested screen",
        desktop: <main>Desktop</main>,
        id: "nested-screen",
        mobile: <main>Mobile</main>,
        title: "Nested screen",
      }),
    ],
  });

  const definition = definitions[0];
  assert.equal(definition?.kind, "screen");
  if (definition?.kind !== "screen") throw new Error("screen missing");
  assert.deepEqual(definition.colorSchemes, ["light"]);
  assert.equal(Object.hasOwn(definition, "route"), false);
});

test("defineScreen flattens declared variants after their parent", () => {
  const definitions = defineScreen({
    ...screenBase,
    variants: [
      {
        description: "Empty tagged screen",
        desktop: "Empty desktop",
        id: "tagged-screen-empty",
        mobile: "Empty mobile",
        title: "Tagged screen, empty",
      },
    ],
  });

  assert.equal(definitions[0]?.id, "tagged-screen");
  assert.equal(definitions[1]?.id, "tagged-screen-empty");
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

test("nested screens keep their own tags and inherit none", () => {
  const [tagged, untagged] = defineRoot({
    children: [
      screen({
        description: "Tagged nested screen",
        desktop: "Desktop",
        id: "tagged-nested",
        mobile: "Mobile",
        tags: ["forms"],
        title: "Tagged nested",
      }),
      screen({
        description: "Untagged nested screen",
        desktop: "Desktop",
        id: "untagged-nested",
        mobile: "Mobile",
        title: "Untagged nested",
      }),
    ],
  });

  if (tagged?.kind !== "screen" || untagged?.kind !== "screen") {
    throw new Error("nested screens missing");
  }
  assert.deepEqual(tagged.tags, ["forms"]);
  assert.equal("tags" in untagged, false);
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

test("top-level entries default to an empty navigation path", () => {
  const entry = defineScreen(screenBase);
  assert.deepEqual(entry.navPath, []);
  assert.deepEqual(validateEntry(resolved(entry), validationConfig), []);
});

test("entry validation rejects Windows device names without changing tag grammar", () => {
  const definition = defineScreen({ ...screenBase, id: "con" });
  assert.deepEqual(validateEntry(resolved(definition), validationConfig), [
    {
      code: "invalid-id",
      id: "con",
      message: "id must be globally unique kebab-case",
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
  return { code: "invalid-tags", id, message, sourceRelativePath };
}

function resolved(definition: RegistryDefinition): ResolvedRegistryEntry {
  return {
    ...definition,
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
