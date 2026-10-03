import assert from "node:assert/strict";
import test from "node:test";

import {
  defineRoot,
  defineScreen,
  folder,
  page,
  screen,
} from "../dist/authoring/definitions.js";
import { entryRoute } from "../packages/viewer/dist/data.js";

test("nested folders derive paths while ids alone derive routes", () => {
  const entries = defineRoot({
    navPath: ["Design"],
    children: [
      folder({
        title: "Browse shell",
        children: [
          screen({
            id: "browse-home",
            title: "Home",
            description: "Home screen",
            mobile: "Mobile",
            desktop: "Desktop",
          }),
          page({
            id: "browse-document",
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
    entries.map((entry) => entryRoute(entry.kind, entry.id)),
    ["screens/browse-home.html", "pages/browse-document.html"],
  );
});

test("root and folders reject empty authored structure", () => {
  assert.throws(
    () => defineRoot({ navPath: ["Design"], children: [] }),
    /root Design has no children/,
  );
  assert.throws(
    () =>
      defineRoot({
        navPath: ["Design"],
        children: [folder({ title: "Views", children: [] })],
      }),
    /folder Design › Views has no children/,
  );
  assert.deepEqual(defineRoot({ children: [] }), []);
  assert.deepEqual(defineRoot({ navPath: [], children: [] }), []);
});

test("root navPath and empty-folder errors use navigation labels", () => {
  assert.throws(
    () =>
      defineRoot({
        navPath: "Design" as unknown as string[],
        children: [],
      }),
    /root navPath must be an array/,
  );
  assert.throws(
    () =>
      defineRoot({
        navPath: ["Design"],
        children: [
          folder({
            title: "Views",
            children: [
              folder({ title: 42 as unknown as string, children: [] }),
            ],
          }),
        ],
      }),
    /folder Design › Views › 42 has no children/,
  );
});

test("flattened variants inherit their parent path", () => {
  const entries = defineScreen({
    id: "browse-home",
    title: "Home",
    description: "Home screen",

    relatedDocs: [],
    mobile: "Mobile",
    desktop: "Desktop",
    navPath: ["Design"],
    variants: [
      {
        id: "browse-dark",
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
