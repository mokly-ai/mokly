import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type {
  PageInput,
  RegistryDefinition,
  ResolvedRegistryEntry,
  ScreenDefinition,
  ScreenInput,
  UseCaseInput,
} from "../dist/authoring/types.js";
import { ComponentContext } from "../dist/components/render_context.js";
import type { ComponentInput } from "../dist/components/types.js";
import { DEFAULT_PUBLIC_EXCLUDE } from "../dist/config/public_exclusions.js";
import type { ResolvedConfig } from "../dist/config/types.js";
import {
  defineComponent,
  definePage,
  defineRoot,
  defineScreen,
  defineUseCase,
  ReviewIgnore,
  folder,
  screen,
} from "../dist/index.js";
import { createCatalogueIndex } from "../dist/registry/catalogue_index.js";
import { validateEntry } from "../dist/registry/entry_validation.js";

import { repositoryRoot } from "./helpers/fixture.js";

const sourceRelativePath = "tests/interactive_authoring.test.tsx";
const config: ResolvedConfig = {
  colorSchemes: ["light"],
  compatibility: {},
  configPath: path.join(repositoryRoot, "mokly.config.ts"),
  entriesDir: path.join(repositoryRoot, "tests"),
  entryGlobs: ["tests/**/*.mockup.{ts,tsx}"],
  generatedOutput: "committed",
  interactive: "serve",
  mockupsDir: path.join(repositoryRoot, "mockups"),
  moduleResolution: { aliases: {}, loaders: {}, packageRoots: [] },
  publicExclude: DEFAULT_PUBLIC_EXCLUDE,
  repoRoot: repositoryRoot,
  review: { base: "main", outDir: ".review", sharedImpact: [] },
  sourceFiles: [sourceRelativePath],
  stylesheets: [],
  watch: { debounceMs: 100, rules: [] },
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
  const nested = defineRoot({
    children: [
      screen({
        description: "Nested",
        desktop: "Desktop",
        id: "nested",
        interactive: false,
        mobile: "Mobile",
        title: "Nested",
      }),
    ],
    navPath: ["Screens"],
  })[0];

  assert.deepEqual(
    inherited.map((entry) => entry.interactive),
    [false, false, false],
  );
  assert.equal("interactive" in selective[0]!, false);
  assert.equal(selective[1]?.interactive, false);
  assert.equal(nested?.kind === "screen" && nested.interactive, false);
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
  assert.throws(
    () =>
      defineRoot({
        children: [
          folder({
            children: [screen(screenInput("folder-child"))],
            interactive: false,
            title: "Folder",
          } as Parameters<typeof folder>[0] & { interactive: false }),
        ],
      }),
    /interactive is not supported on folder markers/,
  );
  const definitions = [
    definePage({
      ...common,
      id: "page",
      interactive: false,
      render: () => "<html><body>Page</body></html>",
    } as PageInput & { interactive: false }),
    defineUseCase({
      ...common,
      id: "journey",
      interactive: false,
      steps: [{ screenId: "screen" }],
    } as UseCaseInput & { interactive: false }),
  ];
  for (const definition of definitions)
    assert.match(
      validateEntry(resolved(definition), config)[0]?.message ?? "",
      /interactive is not supported/,
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
      id: "index-page",
      render: () => "<html><body>Page</body></html>",
    }),
  );
  const index = createCatalogueIndex(
    [page, enabled, disabled],
    [sourceRelativePath],
    ["light"],
  );
  const enabledIndex = index.entries.find((entry) => entry.id === enabled.id);
  const disabledIndex = index.entries.find((entry) => entry.id === disabled.id);

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
    id,
    mobile: "Mobile",
  };
}

function variant(id: string, interactive?: false) {
  return {
    description: id,
    desktop: "Desktop",
    id,
    ...(interactive === false ? { interactive } : {}),
    mobile: "Mobile",
    title: id,
  };
}

const emptySchema = { kind: "object", properties: {} } as const;

function component(interactive: unknown) {
  const input = {
    ...common,
    id: "action",
    interactive,
    propSchema: emptySchema,
    render: () => <button>Action</button>,
    variants: [{ id: "action-default", props: {}, title: "Default" }],
  };
  return defineComponent(
    input as unknown as ComponentInput<typeof emptySchema, readonly []>,
  );
}

function resolved(definition: RegistryDefinition): ResolvedRegistryEntry {
  return {
    ...definition,
    sourcePath: path.join(repositoryRoot, sourceRelativePath),
    sourceRelativePath,
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
