import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { cliErrorPresentation } from "../dist/cli/errors.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

const nested =
  'screen({ id: "home", title: "Home", description: "Home", slug: "home", mobile: "Mobile", desktop: "Desktop" })';

for (const [kind, authored] of [
  ["screen", "[]"],
  ["screen", "undefined"],
  ["page", "[]"],
  ["page", "undefined"],
] as const) {
  test(`build rejects nested ${kind} with authored navPath: ${authored}`, async (context) => {
    const leaf =
      kind === "screen"
        ? `screen({ id: "home", title: "Home", description: "Home", slug: "home", mobile: "Mobile", desktop: "Desktop", navPath: ${authored} })`
        : `page({ id: "home", title: "Home", description: "Home", slug: "home", render: () => "<main>Home</main>", navPath: ${authored} })`;
    const fixture = await createFixture(
      `import { defineRoot, screen, page } from "@mokly/mokly";\nexport const mockups = defineRoot({ path: "design", children: [${leaf}] });`,
    );
    context.after(() => removeFixture(fixture));
    await assert.rejects(
      async () => compileCatalogue(await loadConfig(fixture.root)),
      (error: Error) => {
        assert.match(
          error.message,
          /\[invalid-nested-nav-path\] entries\/fixture\.mockup\.tsx \(home\): nested entry home cannot author navPath/,
        );
        return true;
      },
    );
  });
}

for (const [name, definition, expected] of [
  [
    "authored leaf path",
    `defineRoot({ path: "design", children: [screen({ id: "home", title: "Home", description: "Home", slug: "home", navPath: [], mobile: "Mobile", desktop: "Desktop" })] })`,
    /invalid-nested-nav-path.*entries\/fixture\.mockup\.tsx/s,
  ],
  [
    "empty folder",
    `defineRoot({ path: "design", children: [folder({ title: "Empty", segment: "empty", children: [] })] })`,
    /entries\/fixture\.mockup\.tsx.*folder design\/empty has no children/s,
  ],
  [
    "empty root",
    `defineRoot({ path: "design", navPath: ["Design"], children: [] })`,
    /entries\/fixture\.mockup\.tsx.*root design has no children/s,
  ],
  [
    "empty folder segment",
    `defineRoot({ path: "design", children: [folder({ title: "Views", segment: "", children: [${nested}] })] })`,
    /entries\/fixture\.mockup\.tsx.*folder design segment must be a non-empty string/s,
  ],
] as const) {
  test(`build attributes ${name} to its source module`, async (context) => {
    const fixture = await createFixture(
      `import { defineRoot, folder, screen } from "@mokly/mokly";\nexport const mockups = ${definition};`,
    );
    context.after(() => removeFixture(fixture));
    await assert.rejects(
      async () => compileCatalogue(await loadConfig(fixture.root)),
      expected,
    );
  });
}

test("an empty folder remains a typed build-invalid failure through the consumer facade", async (context) => {
  const fixture = await createFixture(
    'import { defineRoot, folder } from "@mokly/mokly";\nexport const mockups = defineRoot({ path: "design", children: [folder({ title: "Empty", segment: "empty", children: [] })] });',
  );
  context.after(() => removeFixture(fixture));
  await assert.rejects(
    async () => compileCatalogue(await loadConfig(fixture.root)),
    (error: Error) => {
      const presentation = cliErrorPresentation(error);
      assert.equal(presentation.code, "build-invalid");
      assert.match(presentation.headline, /catalogue could not be built/i);
      assert.match(
        presentation.detail ?? "",
        /entries\/fixture\.mockup\.tsx.*folder design\/empty has no children/,
      );
      assert.equal(
        (error.message.match(/\[mokly\/build-invalid\]/g) ?? []).length,
        1,
      );
      assert.doesNotMatch(error.message, /could not bundle consumer modules/);
      return true;
    },
  );
});

for (const [field, value] of [
  ["route", '"overridden.html"'],
  ["variants", "[]"],
  ["navPath", '["Other"]'],
  ["navPath", "undefined"],
] as const) {
  test(`bundled screen variant rejects explicitly authored ${field}: ${value}`, async (context) => {
    const fixture = await createFixture(`
import { defineScreen } from "@mokly/mokly";
export const mockups = defineScreen({
  id: "home", title: "Home", description: "Home", route: "home.html",
  navPath: ["Screens"], mobile: "Mobile", desktop: "Desktop",
  dependencies: [], relatedDocs: [],
  variants: [{ id: "variant", title: "Variant", description: "Variant", slug: "variant", mobile: "Variant mobile", desktop: "Variant desktop", ${field}: ${value} }],
});
`);
    context.after(() => removeFixture(fixture));
    await assert.rejects(
      async () => compileCatalogue(await loadConfig(fixture.root)),
      (error: Error) => {
        assert.match(
          error.message,
          new RegExp(`\\[invalid-variants\\].*variant cannot declare ${field}`),
        );
        assert.match(error.message, /entries\/fixture\.mockup\.tsx/);
        return true;
      },
    );
  });
}

test("genuine consumer evaluation failures remain bundle errors", async (context) => {
  const fixture = await createFixture('throw new Error("consumer exploded");');
  context.after(() => removeFixture(fixture));
  await assert.rejects(
    async () => compileCatalogue(await loadConfig(fixture.root)),
    /could not bundle consumer modules: consumer exploded/,
  );
});

test("folder spelling conflicts attribute both source modules in a real build", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  await writeFile(
    path.join(fixture.entriesDir, "culprit.mockup.tsx"),
    `import { defineScreen } from "@mokly/mokly";
export const mockups = defineScreen({ id: "culprit", title: "Culprit", description: "Culprit", route: "a.html", navPath: ["fixture"], mobile: "Mobile", desktop: "Desktop", dependencies: [], relatedDocs: [] });`,
  );
  await assert.rejects(
    async () => compileCatalogue(await loadConfig(fixture.root)),
    (error: Error) => {
      const lines = error.message
        .split("\n")
        .filter((line) => line.includes("[nav-path-conflict]"));
      assert.equal(lines.length, 2);
      assert.ok(
        lines.some((line) => line.includes("entries/fixture.mockup.tsx")),
      );
      assert.ok(
        lines.some((line) => line.includes("entries/culprit.mockup.tsx")),
      );
      for (const line of lines)
        assert.match(line, /"Fixture".*"fixture".*at the top of Pages/);
      return true;
    },
  );
});

for (const navPath of [null, 42, "Design"]) {
  for (const withVariants of [false, true]) {
    test(`untyped screen navPath ${JSON.stringify(navPath)}${withVariants ? " with variants" : ""} reports once without a TypeError`, async (context) => {
      const fixture = await createFixture(`
import { defineScreen } from "@mokly/mokly";
export const mockups = defineScreen({
  id: "home", title: "Home", description: "Home", route: "home.html",
  navPath: ${JSON.stringify(navPath)}, mobile: "Mobile", desktop: "Desktop",
  dependencies: [], relatedDocs: [],
  ${withVariants ? 'variants: [{ id: "variant", title: "Variant", description: "Variant", slug: "variant", mobile: "Variant mobile", desktop: "Variant desktop" }],' : ""}
});
`);
      context.after(() => removeFixture(fixture));
      await assert.rejects(
        async () => compileCatalogue(await loadConfig(fixture.root)),
        (error: Error) => {
          assert.doesNotMatch(error.message, /TypeError/);
          assert.equal(
            (error.message.match(/\[invalid-nav-path\]/g) ?? []).length,
            1,
          );
          assert.match(
            error.message,
            /entry home navPath index -1 has invalid label/,
          );
          assert.match(error.message, /entries\/fixture\.mockup\.tsx/);
          return true;
        },
      );
    });
  }
}

test("one invalid navPath label yields one registry violation", async (context) => {
  const fixture = await createFixture(`
import { defineScreen } from "@mokly/mokly";
export const mockups = defineScreen({
  id: "home", title: "Home", description: "Home", route: "home.html",
  navPath: [" Valid", "Other"], mobile: "Mobile", desktop: "Desktop",
  dependencies: [], relatedDocs: [],
});
`);
  context.after(() => removeFixture(fixture));
  await assert.rejects(
    async () => compileCatalogue(await loadConfig(fixture.root)),
    (error: Error) => {
      assert.equal(
        (error.message.match(/\[invalid-nav-path\]/g) ?? []).length,
        1,
      );
      assert.match(
        error.message,
        /entry home navPath index 0 has invalid label " Valid"/,
      );
      return true;
    },
  );
});

for (const [name, definition] of [
  [
    "page",
    `definePage({ id: "home", title: "Home", description: "Home", route: "home.html", navPath: null, dependencies: [], relatedDocs: [], render: () => "<main>Home</main>" })`,
  ],
  [
    "use case",
    `defineUseCase({ id: "home", title: "Home", description: "Home", route: "home.html", navPath: null, dependencies: [], relatedDocs: [], steps: [{ screenId: "missing" }] })`,
  ],
  [
    "component",
    `defineComponent({ id: "home", title: "Home", description: "Home", route: "home.html", navPath: null, dependencies: [], relatedDocs: [], propSchema: { kind: "object", properties: {} }, render: () => "Home", variants: [{ id: "default", title: "Default", props: {} }] }).entry`,
  ],
] as const) {
  test(`untyped ${name} null navPath does not default to an empty path`, async (context) => {
    const fixture = await createFixture(`
import { definePage, defineUseCase, defineComponent } from "@mokly/mokly";
export const mockups = ${definition};
`);
    context.after(() => removeFixture(fixture));
    await assert.rejects(
      async () => compileCatalogue(await loadConfig(fixture.root)),
      (error: Error) => {
        assert.doesNotMatch(error.message, /TypeError/);
        assert.equal(
          (error.message.match(/\[invalid-nav-path\]/g) ?? []).length,
          1,
        );
        assert.match(
          error.message,
          /entry home navPath index -1 has invalid label null/,
        );
        return true;
      },
    );
  });
}
