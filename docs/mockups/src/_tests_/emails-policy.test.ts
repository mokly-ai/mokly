import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { paletteColors } from "@mokly-cloud/tokens/palettes";
import { tokens } from "@mokly-cloud/tokens/tokens";

import { logoFiles } from "../emails/document";
import { canvasGradient, emailStyles } from "../emails/styles";

import { catalogueRoot } from "./catalogue-paths";
import { brandRoot, messages, schemes, viewports } from "./email-messages";
import { emailImportViolations, emailSubtreeViolations } from "./emails-policy";

test("the message table preserves the rounded card border", () => {
  for (const scheme of schemes)
    for (const viewport of viewports) {
      const message = emailStyles(scheme, viewport)["e-message"];
      assert.equal(message.borderCollapse, "separate");
      assert.equal(message.borderSpacing, 0);
      const body = messages[0]!.subtree(scheme, viewport);
      assert.match(
        body,
        /<table(?=[^>]*cellspacing="0")(?=[^>]*class="e-message")[^>]*>/i,
      );
      assert.deepEqual(emailSubtreeViolations(body, scheme, brandRoot), []);
      const collapsed = body.replace(
        "border-collapse:separate;border-spacing:0",
        "border-collapse:collapse;border-spacing:0",
      );
      assert.notEqual(collapsed, body);
      assert.match(
        emailSubtreeViolations(collapsed, scheme, brandRoot).join("\n"),
        /message table must use separate borders with zero spacing/,
      );
    }
});

test("the email color policy rejects Folio roles outside its contract", () => {
  for (const scheme of schemes) {
    const body = messages[0]!.subtree(scheme, "desktop");
    const style = emailStyles(scheme, "desktop")["e-card"];
    const excluded = paletteColors(scheme, "folio");
    for (const [property, original, replacement] of [
      ["border-color", style.borderColor, excluded.borderStrong],
      ["background-color", style.backgroundColor, excluded.surfaceMuted],
    ]) {
      const mutated = body.replace(
        property + ":" + original,
        property + ":" + replacement,
      );
      assert.notEqual(mutated, body);
      assert.match(
        emailSubtreeViolations(mutated, scheme, brandRoot).join("\n"),
        new RegExp(property + " is not a " + scheme + " token color"),
      );
    }
  }
});

test("the email policy rejects resources, stray accents and untokenized color", () => {
  const body = messages[0]!.subtree("light", "desktop");
  const folio = emailStyles("light", "desktop");
  for (const mutation of [
    (html: string) =>
      html.replace("<h1", '<img src="https://mokly.ai/mark.png"/><h1'),
    (html: string) => html.replace("<h1", "<span>mokly.</span><h1"),
    (html: string) => html.replace(logoFiles.light, "mokly-icon-light.png"),
    (html: string) =>
      html.replace(
        "border-color:" + folio["e-card"].borderColor,
        "border-color:#123456",
      ),
    (html: string) =>
      html.replace(
        "background-color:" + folio["e-card"].backgroundColor,
        "background-color:" + tokens.color.light.accentSolid,
      ),
    (html: string) =>
      html.replace(
        "background-color:" + folio["e-canvas"].backgroundColor,
        "background-color:" + tokens.color.light.background,
      ),
    (html: string) =>
      html.replace(canvasGradient("light"), canvasGradient("dark")),
    (html: string) =>
      html.replace(
        String(folio["e-card"].boxShadow),
        tokens.shadow.dark.medium,
      ),
    (html: string) => html.replace(brandRoot, "https://mokly.example/brand/"),
    (html: string) => html.replace('class="e-logo-dark"', 'class="e-logo-x"'),
    (html: string) => html.replace('alt="Mokly"', 'alt=""'),
    (html: string) => html.replace('width="96"', 'width="22"'),
    (html: string) => html.replace('height="32"', 'height="22"'),
    (html: string) => html.replace("border:0;", ""),
    (html: string) => html.replace("display:none", "display:block"),
    (html: string) => html.replace("display:block", "display:inline-block"),
    (html: string) =>
      html.replace(
        'style="color:' + tokens.color.light.onAccent,
        'style="color:' + folio["e-title"].color,
      ),
    (html: string) =>
      html.replace(
        "padding:" + folio["e-card"].padding,
        "background:url(https://mokly.ai/m.png)",
      ),
    (html: string) =>
      html.replace("Or open this link:", "Or open https://mokly.ai/unlinked:"),
    (html: string) => html.replace('href="https://', 'href="http://'),
  ])
    assert.ok(
      emailSubtreeViolations(mutation(body), "light", brandRoot).length > 0,
      String(mutation),
    );
});

test("the email source imports only React, the tokens and its own siblings", () => {
  const directory = resolve(catalogueRoot, "src/emails");
  const files = readdirSync(directory, { encoding: "utf8" }).sort();
  assert.deepEqual(files, [
    "content.ts",
    "document.tsx",
    "invitation.tsx",
    "sign-in.tsx",
    "styles.ts",
  ]);
  for (const file of files)
    assert.deepEqual(
      emailImportViolations({
        path: file,
        text: readFileSync(resolve(directory, file), "utf8"),
      }),
      [],
      file,
    );
  for (const specifier of [
    "@firna/ui/theme",
    "react-native",
    "@mokly/mokly",
    "../fixtures/emails",
    "../components/card",
  ])
    assert.equal(
      emailImportViolations({
        path: "sign-in.tsx",
        text: 'import { X } from "' + specifier + '";',
      }).length,
      1,
      specifier,
    );
});
