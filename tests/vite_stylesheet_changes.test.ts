import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { component, stylesheetConfig } from "./fixtures/vite_stylesheets.js";
import { consumer } from "./helpers/mokly_serve.js";
import { build, git, write } from "./helpers/static_changes.js";

test("Vite's lightningcss class maps agree with CSS on both sides of Changes", async (context) => {
  const card = (text: string) =>
    component(
      'import styles from "./card.module.css";',
      `<p className={styles.card}>${text}</p>`,
    );
  const root = await consumer(context, {
    ".gitignore": "node_modules/\n.context/\n",
    "mokly.config.json": stylesheetConfig([], {
      review: { base: "fixture-base" },
    }),
    "vite.config.ts":
      'export default { css: { transformer: "lightningcss" } };',
    "src/card.mockup.tsx": card("Before"),
    "src/card.module.css": ".card { color: teal }",
  });
  for (const args of [
    ["init", "-q"],
    ["config", "user.name", "Mokly Test"],
    ["config", "user.email", "test@example.com"],
    ["add", "."],
    ["commit", "-qm", "base styles"],
    ["branch", "fixture-base"],
  ])
    await git(root, ...args);
  await write(root, "src/card.mockup.tsx", card("After"));
  const built = await build(root, ["--sidecars=1"]);
  assert.ok(built.index.comparisonUrl, built.stderr);
  const classes = [];
  for (const side of ["before", "after"]) {
    const snapshot = path.join(
      built.output,
      built.index.comparisonUrl,
      "snapshots",
      side,
      "mokly-generated",
    );
    const html = await fs.readFile(
      path.join(snapshot, "card/index.mobile.html"),
      "utf8",
    );
    const scoped = /class="(mokly_[A-Za-z\d_-]+_card)"/.exec(html)?.[1];
    assert.ok(scoped, html);
    assert.doesNotMatch(scoped, /^mokly_[a-f\d]{12}_card$/);
    const css = await fs.readFile(
      path.join(snapshot, "styles/src/card.mockup.tsx.css"),
      "utf8",
    );
    assert.ok(css.includes(`.${scoped} {`), css);
    classes.push(scoped);
  }
  assert.equal(classes[0], classes[1]);
});
