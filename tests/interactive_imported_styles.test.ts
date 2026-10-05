import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { DocumentService } from "../dist/server/demand/service.js";

import {
  acceptedStyles,
  compileLiveStyles,
  interactiveStylesFixture,
} from "./helpers/interactive_styles.js";

test("Live replays the exact Static CSS Module map and empty plain stylesheet module", async (t) => {
  const fixture = await interactiveStylesFixture();
  t.after(() => fixture.remove());
  const runtime = await acceptedStyles(fixture.root);
  const documents = new DocumentService(runtime);
  t.after(() => documents.close());
  const document = await documents.read("home/index.desktop.html");
  const code = await compileLiveStyles(runtime);
  const name = document.html.match(/class="(mokly_[a-f0-9]{12}_card)"/)?.[1];
  assert.ok(name);
  assert.match(document.html, new RegExp(`data-module="${name}"`));
  assert.ok(code.includes(name));
  assert.ok(runtime.interactiveSources);
  const plain = runtime.interactiveSources.files.find((file) =>
    file.paths.includes("entries/plain.css"),
  );
  const module = runtime.interactiveSources.files.find((file) =>
    file.paths.includes("entries/card.module.css"),
  );
  assert.ok(plain);
  assert.ok(module);
  assert.equal(Buffer.from(plain.bytes).toString(), "");
  assert.ok(Buffer.from(module.bytes).toString().includes(name));
  assert.match(
    String(runtime.styleOutputs.find(([route]) => route.endsWith(".css"))?.[1]),
    /rebeccapurple/,
  );
  assert.doesNotMatch(code, /background-image|fixture-color/);
});

for (const edit of ["edit", "delete", "break"] as const) {
  test(`accepted stylesheet modules stay pinned after ${edit}, before first Live compilation`, async (t) => {
    const fixture = await interactiveStylesFixture();
    t.after(() => fixture.remove());
    const accepted = await acceptedStyles(fixture.root);
    const expected = await compileLiveStyles(accepted);
    const freshAccepted = await acceptedStyles(fixture.root);
    for (const name of ["plain.css", "card.module.css"]) {
      const file = path.join(fixture.entriesDir, name);
      if (edit === "delete") await fs.rm(file);
      else
        await fs.writeFile(
          file,
          edit === "break"
            ? ":global() { color: red; }\n"
            : ".card { color: blue; } .changed { color: green; }\n",
        );
    }
    assert.equal(await compileLiveStyles(freshAccepted), expected);
    if (edit === "edit") {
      const next = await acceptedStyles(fixture.root);
      const code = await compileLiveStyles(next);
      assert.notEqual(code, expected);
      assert.match(code, /mokly_[a-f0-9]{12}_changed/);
    } else {
      await assert.rejects(acceptedStyles(fixture.root), {
        code: "build-invalid",
      });
    }
  });
}

test("an unrecorded repository stylesheet fails closed instead of reading disk", async (t) => {
  const fixture = await interactiveStylesFixture();
  t.after(() => fixture.remove());
  const runtime = await acceptedStyles(fixture.root);
  assert.ok(runtime.interactiveSources);
  await fs.writeFile(
    path.join(fixture.entriesDir, "uncaptured.css"),
    "body { color: red; }\n",
  );
  const files = runtime.interactiveSources.files.map((file) =>
    file.paths.includes("entries/fixture.mockup.tsx")
      ? {
          ...file,
          bytes: Buffer.from(
            Buffer.from(file.bytes)
              .toString()
              .replace("./plain.css", "./uncaptured.css"),
          ),
        }
      : file,
  );
  await assert.rejects(
    compileLiveStyles({
      ...runtime,
      interactiveSources: { ...runtime.interactiveSources, files },
    }),
    {
      code: "interactive-bundle",
      reason: "source-not-captured",
      module: "entries/uncaptured.css",
    },
  );
});
