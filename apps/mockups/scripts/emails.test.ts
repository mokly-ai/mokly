/** Generated-template drift tests using real files in an isolated directory. */

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";

import {
  emailStyles,
  overrideStyles,
} from "../../../docs/mockups/src/emails/styles";
import { buildEmailTemplates, emailTemplates } from "./emails";

test("email lengths use pixel values in every composition", () => {
  for (const scheme of ["light", "dark"] as const)
    for (const viewport of ["mobile", "desktop"] as const) {
      const styles = emailStyles(scheme, viewport);
      assert.doesNotMatch(JSON.stringify(styles), /[\d.]rem\b/);
      assert.equal(styles["e-title"].fontSize, "24px");
      assert.equal(styles["e-title"].lineHeight, "32px");
      assert.equal(styles["e-title"].letterSpacing, "-0.02em");
      assert.equal(styles["e-message"].width, "100%");
      assert.equal(styles["e-message"].borderSpacing, 0);
      assert.equal(styles["e-action-link"].fontSize, "15px");
      assert.equal(styles["e-action-link"].lineHeight, "22px");
      assert.equal(styles["e-action-link"].padding, "12px 24px");
      assert.equal(styles["e-canvas"].backgroundSize, "24px 24px");
      assert.equal(
        styles["e-card"].padding,
        viewport === "desktop" ? "40px" : "32px 20px 48px",
      );
    }
  assert.doesNotMatch(overrideStyles(), /[\d.]rem\b/);
  for (const [name, contents] of emailTemplates())
    if (name.endsWith(".html"))
      assert.doesNotMatch(contents, /[\d.]rem\b/, name);
});

test("plain text and subjects interpolate without HTML entities", () => {
  const templates = emailTemplates();
  for (const kind of ["sign-in", "invitation"]) {
    const html = templates.get(`${kind}.html`)!;
    const text = templates.get(`${kind}.txt`)!;
    const subject = templates.get(`${kind}.subject.txt`)!;
    assert.match(html, /\{\{link\}\}/);
    assert.doesNotMatch(html, /\{\{\{/);
    assert.match(text, /\{\{\{link\}\}\}/);
    assert.doesNotMatch(text, /(?<!\{)\{\{[a-zA-Z]+\}\}(?!\})/);
    assert.doesNotMatch(subject, /(?<!\{)\{\{[a-zA-Z]+\}\}(?!\})/);
  }
  assert.match(
    templates.get("invitation.subject.txt")!,
    /\{\{\{organization\}\}\}/,
  );
});

test("generator rejects changed and extra committed files", async () => {
  const out = await mkdtemp(resolve(tmpdir(), "mkc-email-templates-"));
  try {
    await buildEmailTemplates(out, false);
    await buildEmailTemplates(out, true);
    const path = resolve(out, "sign-in.html");
    await writeFile(path, (await readFile(path, "utf8")) + "stale\n");
    await assert.rejects(
      buildEmailTemplates(out, true),
      /sign-in.html differs/,
    );
    await buildEmailTemplates(out, false);
    await writeFile(resolve(out, "obsolete.html"), "obsolete\n");
    await assert.rejects(buildEmailTemplates(out, true), /file list differs/);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});
