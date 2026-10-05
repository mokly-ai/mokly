import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type {
  PageInput,
  EntryDefinition,
  FolderInput,
  ResolvedRegistryEntry,
  ScreenDefinition,
  ScreenInput,
  UseCaseInput,
} from "../dist/authoring/types.js";
import { ComponentContext } from "../dist/components/render_context.js";
import type { ComponentInput } from "../dist/components/types.js";
import {
  defineComponent,
  definePage,
  defineFolder,
  defineScreen,
  defineUseCase,
  ReviewIgnore,
} from "../dist/index.js";
import { createCatalogueIndex } from "../dist/registry/catalogue_index.js";
import { validateEntry } from "../dist/registry/entry_validation.js";
import { collectModuleExports } from "../dist/registry/export_collection.js";
import { resolveDefinitions } from "../dist/registry/resolve_definitions.js";

import { repositoryRoot } from "./helpers/fixture.js";
import { registryValidationConfig } from "./helpers/registry_validation.js";
import { resolvedEntry } from "./helpers/resolved.js";

const sourceRelativePath = "tests/interactive_authoring.test.tsx";
const config = {
  ...registryValidationConfig(sourceRelativePath),
  interactive: "serve" as const,
};

const common = {
  dependencies: [] as readonly string[],
  description: "Interactive fixture",
  relatedDocs: [] as readonly string[],
  title: "Interactive fixture",
};

test("screen variants and nested screens resolve the false-only opt-out", () => {
  const inherited = screenDefinitions(
    defineScreen({
      ...screenInput("parent"),
      interactive: false,
      variants: [variant("inherited"), variant("explicit", false)],
    }),
  );
  const selective = screenDefinitions(
    defineScreen({
      ...screenInput("selective"),
      variants: [variant("selective-opt-out", false)],
    }),
  );
  const nested = defineScreen({
    ...screenInput("Screens/nested"),
    interactive: false,
  });

  assert.deepEqual(
    inherited.map((entry) => entry.interactive),
    [false, false, false],
  );
  assert.equal("interactive" in selective[0]!, false);
  assert.equal(selective[1]?.interactive, false);
  assert.equal(oneScreen(nested).interactive, false);
});

test("interactive accepts only false on screens and components", () => {
  assert.deepEqual(
    validateEntry(
      resolved(oneScreen(defineScreen(screenInput("enabled")))),
      config,
    ),
    [],
  );
  assert.deepEqual(
    validateEntry(
      resolved(
        oneScreen(
          defineScreen({ ...screenInput("disabled"), interactive: false }),
        ),
      ),
      config,
    ),
    [],
  );
  for (const interactive of [true, "serve", null, undefined]) {
    const definition = defineScreen({
      ...screenInput(`invalid-${String(interactive)}`),
      interactive,
    } as unknown as ScreenInput);
    assert.match(
      validateEntry(resolved(oneScreen(definition)), config)[0]?.message ?? "",
      /interactive must be false/,
    );
    assert.throws(
      () => component(interactive as false),
      /interactive must be false/,
    );
  }
  assert.doesNotThrow(() => component(false));
});

test("folders, pages and use cases reject interactive", () => {
  const folder = defineFolder({
    path: "Screens",
    title: "Folder",
    interactive: false,
  } as FolderInput & { interactive: false });
  assert.match(
    resolveDefinitions(
      collectModuleExports({ folder }, sourceRelativePath),
      config,
    ).diagnostics[0]?.message ?? "",
    /unknown field interactive/,
  );
  const definitions = [
    definePage({
      ...common,
      path: "page",
      interactive: false,
      render: () => "<html><body>Page</body></html>",
    } as PageInput & { interactive: false }),
    defineUseCase({
      ...common,
      path: "journey",
      interactive: false,
      steps: [{ screenPath: "screen" }],
    } as UseCaseInput & { interactive: false }),
  ];
  for (const definition of definitions)
    assert.match(
      validateEntry(resolved(definition), config)[0]?.message ?? "",
      /unknown field interactive/,
    );
});

test("catalogue index carries resolved eligibility only for Live entry kinds", () => {
  const enabled = resolved(
    oneScreen(defineScreen(screenInput("enabled-index"))),
  );
  const disabled = resolved(
    oneScreen(
      defineScreen({ ...screenInput("disabled-index"), interactive: false }),
    ),
  );
  const page = resolved(
    definePage({
      ...common,
      path: "index-page",
      render: () => "<html><body>Page</body></html>",
    }),
  );
  const index = createCatalogueIndex(
    [page, enabled, disabled],
    [sourceRelativePath],
    ["light"],
  );
  const enabledIndex = index.entries.find(
    (entry) => entry.path === enabled.path,
  );
  const disabledIndex = index.entries.find(
    (entry) => entry.path === disabled.path,
  );

  assert.equal(enabledIndex?.kind, "screen");
  assert.equal(disabledIndex?.kind, "screen");
  assert.equal(
    enabledIndex?.kind === "screen" && enabledIndex.interactive,
    true,
  );
  assert.equal(
    disabledIndex?.kind === "screen" && disabledIndex.interactive,
    false,
  );
  assert.equal(
    "interactive" in index.entries.find((entry) => entry.kind === "page")!,
    false,
  );
});

test("interactive component scope emits no component or Review sentinels", () => {
  const registered = component(false);
  resolveDefinitions(
    collectModuleExports({ registered }, sourceRelativePath),
    config,
  );
  const html = renderToStaticMarkup(
    <ComponentContext
      value={{
        context: { colorScheme: "light", viewport: "mobile" },
        kind: "interactive",
      }}
    >
      <registered.Component />
      <ReviewIgnore id="shared-chrome">
        <span>Review child</span>
      </ReviewIgnore>
    </ComponentContext>,
  );

  assert.equal(html, "<button>Action</button><span>Review child</span>");
  assert.doesNotMatch(html, /template|mokly-component|mokly-review/);
});

function screenInput(id: string): ScreenInput {
  return {
    ...common,
    desktop: "Desktop",
    path: id,
    mobile: "Mobile",
  };
}

function variant(id: string, interactive?: false) {
  return {
    description: id,
    desktop: "Desktop",
    slug: id,
    ...(interactive === false ? { interactive } : {}),
    mobile: "Mobile",
    title: id,
  };
}

const emptySchema = { kind: "object", properties: {} } as const;

function component(interactive: unknown) {
  const input = {
    ...common,
    path: "action",
    interactive,
    propSchema: emptySchema,
    render: () => <button>Action</button>,
    variants: [{ slug: "default", props: {}, title: "Default" }],
  };
  return defineComponent(
    input as unknown as ComponentInput<typeof emptySchema, readonly []>,
  );
}

function resolved(definition: EntryDefinition): ResolvedRegistryEntry {
  return {
    ...resolvedEntry(definition, sourceRelativePath),
    sourcePath: path.join(repositoryRoot, sourceRelativePath),
  };
}

function screenDefinitions(
  value: ScreenDefinition | readonly ScreenDefinition[],
): readonly ScreenDefinition[] {
  return Array.isArray(value) ? value : [value as ScreenDefinition];
}

function oneScreen(
  value: ScreenDefinition | readonly ScreenDefinition[],
): ScreenDefinition {
  if (Array.isArray(value)) throw new Error("expected one screen");
  return value as ScreenDefinition;
}
