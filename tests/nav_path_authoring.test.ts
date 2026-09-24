import assert from "node:assert/strict";
import test from "node:test";

import {
  defineRoot,
  defineScreen,
  folder,
  page,
  screen,
} from "../dist/authoring/definitions.js";

test("nested folders derive paths independently of routes", () => {
  const entries = defineRoot({
    path: "design",
    navPath: ["Design"],
    children: [
      folder({
        segment: "views",
        title: "Browse shell",
        children: [
          screen({
            id: "browse-home",
            slug: "home",
            title: "Home",
            description: "Home screen",
            mobile: "Mobile",
            desktop: "Desktop",
          }),
          page({
            id: "browse-document",
            slug: "document",
            title: "Document",
            description: "Document page",
            render: () => "<main>Document</main>",
          }),
        ],
      }),
    ],
  });
  assert.deepEqual(
    entries.map(({ navPath }) => navPath),
    [
      ["Design", "Browse shell"],
      ["Design", "Browse shell"],
    ],
  );
  assert.deepEqual(
    entries.map((entry) => "route" in entry && entry.route),
    ["design/views/home.html", "design/views/document.html"],
  );
});

test("root and folders reject empty authored structure", () => {
  assert.throws(
    () => defineRoot({ path: "design", navPath: ["Design"], children: [] }),
    /root design has no children/,
  );
  assert.throws(
    () =>
      defineRoot({
        path: "design",
        children: [folder({ segment: "views", title: "Views", children: [] })],
      }),
    /folder design\/views has no children/,
  );
  assert.deepEqual(defineRoot({ path: "design", children: [] }), []);
  assert.deepEqual(
    defineRoot({ path: "design", navPath: [], children: [] }),
    [],
  );
});

test("root paths must be arrays and folder segments cannot be empty", () => {
  assert.throws(
    () =>
      defineRoot({
        path: "design",
        navPath: "Design" as unknown as string[],
        children: [],
      }),
    /root design navPath must be an array/,
  );
  assert.throws(
    () =>
      defineRoot({
        path: "design",
        children: [
          folder({
            segment: "",
            title: "Views",
            children: [
              screen({
                id: "view",
                slug: "view",
                title: "View",
                description: "A view",
                mobile: "Mobile",
                desktop: "Desktop",
              }),
            ],
          }),
        ],
      }),
    /folder design segment must be a non-empty string/,
  );
});

test("flattened variants inherit their parent path", () => {
  const entries = defineScreen({
    id: "browse-home",
    route: "browse/home.html",
    title: "Home",
    description: "Home screen",
    dependencies: [],
    relatedDocs: [],
    mobile: "Mobile",
    desktop: "Desktop",
    navPath: ["Design"],
    variants: [
      {
        id: "browse-dark",
        slug: "dark",
        title: "Dark",
        description: "Dark screen",
        mobile: "Dark mobile",
        desktop: "Dark desktop",
      },
    ],
  });
  assert.deepEqual(
    entries.map(({ navPath }) => navPath),
    [["Design"], ["Design"]],
  );
  assert.notStrictEqual(entries[0]?.navPath, entries[1]?.navPath);
});
