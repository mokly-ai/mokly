import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { classifyComponents } from "../dist/review/component_classification.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";

const hiddenResourceCases = [
  {
    name: "srcset and inline style",
    content:
      "<img srcSet=\"../one.svg 1x, ../two.svg 2x\" style={{ backgroundImage: 'url(../background.svg)' }} />",
    files: {
      "one.svg": "one",
      "two.svg": "two",
      "background.svg": "background",
    },
    changed: "two.svg",
    before: "base image",
    after: "head image",
  },
  {
    name: "embedded HTML closure",
    content: '<iframe src="../embedded.html" />',
    files: {
      "embedded.html": '<img src="nested.svg">',
      "nested.svg": "nested",
    },
    changed: "nested.svg",
    before: "base image",
    after: "head image",
  },
  {
    name: "stylesheet import closure",
    content: '<link rel="stylesheet" href="../main.css" />',
    files: {
      "main.css": '@import "./nested.css";',
      "nested.css": "body { color: red; }",
    },
    changed: "nested.css",
    before: "body { color: red; }",
    after: "body { color: blue; }",
  },
] as const;

for (const resourceCase of hiddenResourceCases)
  for (const generatedOutput of ["committed", "derived"] as const)
    test(`select-hidden ${resourceCase.name} agrees in ${generatedOutput} mode`, async (t) => {
      const fixture = await createFixture(
        componentEntrySource({
          paneRender: "(props) => <select>{props.children}</select>",
          body: `<pane.Component>${resourceCase.content}</pane.Component>`,
        }),
      );
      t.after(() => removeFixture(fixture));
      const config = await loadConfig(fixture.root);
      const compilation = await compileCatalogue(config);
      const reader = (changedContent: string) => ({
        read: async (route: string) => {
          const generated = textOutput(compilation.outputs, route);
          if (generated !== undefined) return Buffer.from(generated);
          const content =
            resourceCase.files[route as keyof typeof resourceCase.files];
          assert.notEqual(content, undefined, route);
          return Buffer.from(
            route === resourceCase.changed ? changedContent : content,
          );
        },
        readIfExists: async (route: string) => {
          const content =
            resourceCase.files[route as keyof typeof resourceCase.files];
          if (content === undefined) return undefined;
          return Buffer.from(
            route === resourceCase.changed ? changedContent : content,
          );
        },
      });
      const classify = (useFastPath: boolean) =>
        classifyComponents({
          before: compilation.manifest,
          after: compilation.manifest,
          beforeReader: reader(resourceCase.before),
          afterReader: reader(resourceCase.after),
          config: { ...config, generatedOutput },
          changedPaths:
            generatedOutput === "committed"
              ? [`mockups/${resourceCase.changed}`]
              : [],
          baseCommit: "a".repeat(40),
          baseRef: "main",
          useFastPath,
        });
      const [optimized, complete] = await Promise.all([
        classify(true),
        classify(false),
      ]);
      assert.deepEqual(optimized, complete);
      assert.ok(
        optimized.changes.some((change) =>
          change.reasons.some((reason) =>
            generatedOutput === "committed"
              ? reason.kind === "dependency" &&
                reason.path === `mockups/${resourceCase.changed}`
              : reason.kind === "material",
          ),
        ),
      );
    });

for (const direction of ["added", "removed"] as const)
  test(`select-hidden stylesheet ${direction} import membership agrees`, async (t) => {
    const fixture = await createFixture(
      componentEntrySource({
        paneRender: "(props) => <select>{props.children}</select>",
        body: '<pane.Component><link rel="stylesheet" href="../main.css" /></pane.Component>',
      }),
    );
    t.after(() => removeFixture(fixture));
    const config = await loadConfig(fixture.root);
    const compilation = await compileCatalogue(config);
    const reader = (hasImport: boolean) => ({
      read: async (route: string) => {
        const generated = textOutput(compilation.outputs, route);
        if (generated !== undefined) return Buffer.from(generated);
        if (route === "main.css")
          return Buffer.from(hasImport ? '@import "./nested.css";' : "");
        assert.equal(route, "nested.css");
        return Buffer.from("body { color: purple; }");
      },
      readIfExists: async (route: string) => {
        if (route === "main.css")
          return Buffer.from(hasImport ? '@import "./nested.css";' : "");
        if (route === "nested.css")
          return hasImport ? Buffer.from("body { color: purple; }") : undefined;
        return undefined;
      },
    });
    const classify = (useFastPath: boolean) =>
      classifyComponents({
        before: compilation.manifest,
        after: compilation.manifest,
        beforeReader: reader(direction === "removed"),
        afterReader: reader(direction === "added"),
        config: { ...config, generatedOutput: "derived" },
        changedPaths: [],
        baseCommit: "a".repeat(40),
        baseRef: "main",
        useFastPath,
      });
    const [optimized, complete] = await Promise.all([
      classify(true),
      classify(false),
    ]);
    assert.deepEqual(optimized, complete);
    assert.ok(
      optimized.changes.some(
        (change) =>
          change.kind === "screen" &&
          change.after?.id === "home" &&
          change.reasons.some((reason) => reason.kind === "material"),
      ),
    );
  });

for (const context of ["select", "template"] as const)
  for (const generatedOutput of ["committed", "derived"] as const)
    test(`instance projection exposes a sibling hidden by unclosed ${context} HTML in ${generatedOutput} mode`, async (t) => {
      const fixture = await createFixture(
        componentEntrySource({
          actionRender: `(props) => <div dangerouslySetInnerHTML={{ __html: "<${context}>" }} />`,
          body: '<action.Component label="Continue" /><img loading="lazy" src="../image.svg" />',
        }),
      );
      t.after(() => removeFixture(fixture));
      const config = await loadConfig(fixture.root);
      const compilation = await compileCatalogue(config);
      const reader = (content: string) => ({
        read: async (route: string) => {
          const generated = textOutput(compilation.outputs, route);
          if (generated !== undefined) return Buffer.from(generated);
          assert.equal(route, "image.svg");
          return Buffer.from(content);
        },
        readIfExists: async (route: string) =>
          route === "image.svg" ? Buffer.from(content) : undefined,
      });
      const classify = (useFastPath: boolean) =>
        classifyComponents({
          before: compilation.manifest,
          after: compilation.manifest,
          beforeReader: reader("base image"),
          afterReader: reader("head image"),
          config: { ...config, generatedOutput },
          changedPaths:
            generatedOutput === "committed" ? ["mockups/image.svg"] : [],
          baseCommit: "a".repeat(40),
          baseRef: "main",
          useFastPath,
        });
      const [optimized, complete] = await Promise.all([
        classify(true),
        classify(false),
      ]);
      assert.deepEqual(optimized, complete);
      assert.ok(
        optimized.changes.some(
          (change) =>
            change.kind === "screen" &&
            change.after?.id === "home" &&
            change.reasons.some((reason) =>
              generatedOutput === "committed"
                ? reason.kind === "dependency" &&
                  reason.path === "mockups/image.svg"
                : reason.kind === "material",
            ),
        ),
      );
    });
