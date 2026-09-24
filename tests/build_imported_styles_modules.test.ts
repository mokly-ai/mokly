import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";
import {
  compileFixture,
  entryStyle,
  styleFixture,
} from "./helpers/imported_styles_fixture.js";

test("CSS Modules export a default class map and matching named binding", async (t) => {
  const fixture = await createFixture(
    validEntrySource({ body: "<div className={styles.card}>{card}</div>" }),
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "card.module.css"),
    ".card{composes: helper; color:red}.helper{color:blue}",
  );
  await fs.appendFile(
    fixture.entryPath,
    '\nimport styles, { card } from "./card.module.css";',
  );
  const compiled = await compileFixture(fixture);
  const css = compiled.outputs.get(entryStyle) as string;
  const classes = (
    compiled.outputs.get("screens/home.mobile.html") as string
  ).match(/class="([^"]+)"/)?.[1];
  assert.ok(classes, "CSS Modules class map must be used by the component");
  for (const name of classes.split(" "))
    assert.ok(css.includes(`.${name}`), name);
});

test("CSS Modules keep strict-mode reserved names only on the default export", async (t) => {
  const fixture = await createFixture(
    validEntrySource({ body: "<div className={styles.arguments}>Card</div>" }),
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "reserved.module.css"),
    ".arguments{color:red}.eval{color:blue}.valid{color:green}",
  );
  await fs.appendFile(
    fixture.entryPath,
    '\nimport styles, { valid } from "./reserved.module.css";',
  );
  const compiled = await compileFixture(fixture);
  const html = compiled.outputs.get("screens/home.mobile.html") as string;
  const css = compiled.outputs.get(entryStyle) as string;
  const value = html.match(/class="([^"]+)"/)?.[1];
  assert.ok(value);
  assert.ok(css.includes(`.${value}`));
});

test("adding an unrelated same-basename CSS Module does not rename existing classes", async (t) => {
  const fixture = await createFixture(
    validEntrySource({ body: "<div className={styles.card}>Card</div>" }),
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "card.module.css"),
    ".card{color:red}",
  );
  await fs.appendFile(
    fixture.entryPath,
    '\nimport styles from "./card.module.css";',
  );
  const before = (await compileFixture(fixture)).outputs.get(
    "screens/home.mobile.html",
  ) as string;
  await fs.mkdir(path.join(fixture.entriesDir, "other"));
  await fs.writeFile(
    path.join(fixture.entriesDir, "other/card.module.css"),
    ".card{color:blue}",
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "new.mockup.ts"),
    'import "./other/card.module.css"; export const mockups = [];',
  );
  const after = (await compileFixture(fixture)).outputs.get(
    "screens/home.mobile.html",
  ) as string;
  assert.equal(before, after);
});

test("CSS Module cross-file composes and cycles use catalogued errors", async (t) => {
  const fixture = await styleFixture('.a { composes: b from "./other.css" }', {
    module: true,
  });
  t.after(() => removeFixture(fixture));
  await assert.rejects(
    () => compileFixture(fixture),
    (error: Error) => {
      assert.equal(
        error.message,
        "[mokly/build-invalid] CSS Modules cross-file composes is unsupported in entries/fixture.module.css: ./other.css; compose within this file or use a global name",
      );
      return true;
    },
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "fixture.module.css"),
    ".a { composes: b } .b { composes: a }",
  );
  await assert.rejects(
    () => compileFixture(fixture),
    (error: Error) => {
      assert.equal(
        error.message,
        "[mokly/build-invalid] CSS Modules composition cycle in entries/fixture.module.css: a; remove the cycle",
      );
      return true;
    },
  );
});

test("concurrent CSS Module failures report the first repository-relative stylesheet", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  for (const name of ["z", "a"])
    await fs.writeFile(
      path.join(fixture.entriesDir, `${name}.module.css`),
      `${name === "z" ? ".filler{color:red}".repeat(10000) : ""}.card{composes: card from "./other.css"}`,
    );
  await fs.appendFile(
    fixture.entryPath,
    '\nimport "./z.module.css"; import "./a.module.css";',
  );
  await assert.rejects(
    () => compileFixture(fixture),
    (error: Error) => {
      assert.equal(
        error.message,
        "[mokly/build-invalid] CSS Modules cross-file composes is unsupported in entries/a.module.css: ./other.css; compose within this file or use a global name",
      );
      return true;
    },
  );
});
