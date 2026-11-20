import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { test } from "node:test";

import { tokenCss } from "@mokly-cloud/tokens/token-css";
import { parse, parseFragment, serialize, serializeOuter } from "parse5";

import { logoFiles } from "../emails/brand";
import {
  EMAIL_BRAND_FILES,
  EMAIL_BRAND_ROOT,
  EMAIL_STYLE_FILES,
} from "../screens/design/email/parts/metadata";

import { catalogueEntries } from "./catalogue-index";
import {
  catalogueRoot,
  screenFile,
  screenView,
  stylesheetPath,
} from "./catalogue-paths";
import { authoredPath } from "./catalogue-reads";
import {
  attribute,
  elements,
  repositoryRoot,
  siteEntry,
} from "./design-site-test-helpers";
import { brandRoot, messages, schemes, viewports } from "./email-messages";
import { emailSubtreeViolations } from "./emails-policy";

/**
 * The delivered message inside one generated email document, serialized
 * after parsing. Mokly writes each document with its own HTML serializer, so
 * a body compares with it once both are parsed.
 */
function generatedMessage(html: string): string {
  const [message] = elements(
    parse(html),
    (element) => attribute(element, "data-mkc-email") !== undefined,
  );
  return message ? serializeOuter(message) : "";
}

test("the Design Email folder owns both email screens with all four documents", () => {
  assert.deepEqual(
    catalogueEntries()
      .filter((entry) => entry.path.startsWith("design/email/"))
      .map((entry) => entry.path)
      .sort(),
    messages.map((message) => message.id).sort(),
  );
  for (const { id } of messages) {
    const entry = siteEntry(id);
    assert.equal(entry.kind, "screen", id);
    if (entry.kind !== "screen") continue;
    assert.equal(dirname(entry.path), "design/email");
    assert.equal(entry.variantOf, undefined);
    assert.deepEqual(entry.colorSchemes, ["light", "dark"]);
    for (const scheme of schemes)
      for (const viewport of viewports)
        assert.ok(readFileSync(screenFile(id, viewport, scheme), "utf8"));
  }
});

test("every generated email is the shared body in its own scheme and viewport", () => {
  for (const message of messages)
    for (const scheme of schemes)
      for (const viewport of viewports) {
        const path = screenView(message.id, viewport, scheme);
        const html = readFileSync(
          screenFile(message.id, viewport, scheme),
          "utf8",
        );
        const body = message.subtree(scheme, viewport);
        assert.equal(
          generatedMessage(html),
          serialize(parseFragment(body)),
          path,
        );
        assert.deepEqual(
          emailSubtreeViolations(body, scheme, brandRoot),
          [],
          path,
        );
        assert.ok(
          html.includes('<p class="email-subject">' + message.subject + "</p>"),
          path,
        );
        assert.ok(
          html.includes(
            '<p class="email-preheader">' + message.preheader + "</p>",
          ),
          path,
        );
        assert.ok(!body.includes(message.preheader), path);
        for (const sheet of EMAIL_STYLE_FILES)
          assert.ok(
            html.includes(
              'href="' +
                relative(dirname(path), stylesheetPath(authoredPath(sheet))) +
                '"',
            ),
            path + sheet,
          );
        assert.equal(html.match(/rel="stylesheet"/g)?.length, 2, path);
        assert.doesNotMatch(html, /rel="preload"/, path);
      }
});

test("the catalogue's logos are the published lockups", () => {
  assert.deepEqual(EMAIL_BRAND_FILES, [logoFiles.dark, logoFiles.light]);
  for (const file of EMAIL_BRAND_FILES) {
    const copied = readFileSync(
      resolve(catalogueRoot, EMAIL_BRAND_ROOT + file),
    );
    const published = readFileSync(
      resolve(repositoryRoot, "apps/site/public/brand", file),
    );
    assert.ok(copied.equals(published), file);
    assert.equal(copied.readUInt32BE(16), 768, file);
    assert.equal(copied.readUInt32BE(20), 256, file);
  }
});

/** The stylesheet rules of the data-only Mokly configuration, in order. */
function stylesheetRules(): { match: string; stylesheets: string[] }[] {
  const config: unknown = JSON.parse(
    readFileSync(resolve(repositoryRoot, "mokly.config.json"), "utf8"),
  );
  assert.ok(
    typeof config === "object" &&
      config !== null &&
      "stylesheets" in config &&
      Array.isArray(config.stylesheets),
  );
  return config.stylesheets.map((rule: unknown) => {
    assert.ok(
      typeof rule === "object" &&
        rule !== null &&
        "match" in rule &&
        typeof rule.match === "string" &&
        "stylesheets" in rule &&
        Array.isArray(rule.stylesheets),
    );
    return { match: rule.match, stylesheets: rule.stylesheets.map(String) };
  });
}

test("an email document links only the base sheet and the inbox frame", () => {
  const rules = stylesheetRules();
  const matches = rules.map((rule) => rule.match);
  const email = matches.indexOf("design/email/**/index.html");
  assert.ok(email >= 0);
  assert.ok(
    email <
      matches.indexOf(
        "product/{account,recovery,settings,viewer}/**/index.html",
      ),
  );
  assert.ok(email < matches.indexOf("**/*.html"));
  assert.deepEqual(EMAIL_STYLE_FILES, [
    "styles/base.css",
    "styles/email/frame.css",
  ]);
  assert.deepEqual(
    rules[email]?.stylesheets,
    EMAIL_STYLE_FILES.map(authoredPath),
  );
  const css = readFileSync(
    resolve(catalogueRoot, EMAIL_STYLE_FILES[1]!),
    "utf8",
  );
  assert.doesNotMatch(css, /#[0-9a-f]{3}|rgba?\(|hsla?\(/i);
  assert.doesNotMatch(css, /--mk-[\w-]+\s*:/);
  assert.doesNotMatch(css, /@font-face|url\(/);
  const used = [...css.matchAll(/var\((--mk-[\w-]+)\)/g)].map(
    (match) => match[1]!,
  );
  assert.ok(used.length > 8);
  for (const scheme of schemes)
    for (const viewport of viewports) {
      const emitted = tokenCss(scheme, viewport);
      for (const role of used)
        assert.ok(emitted.includes(role + ":"), scheme + " " + role);
    }
});

test("both email screens are tagged and reached by the journeys that show them", () => {
  const entries = catalogueEntries();
  const byId = new Map(entries.map((entry) => [entry.path, entry]));
  for (const { id } of messages) {
    const entry = byId.get(id);
    assert.ok(entry?.kind === "screen", id);
    if (entry?.kind !== "screen") continue;
    assert.deepEqual([...entry.tags].sort(), ["email", "folio"]);
  }
  const onboarding = byId.get("flows/product-onboarding");
  assert.ok(onboarding?.kind === "use-case");
  if (onboarding?.kind !== "use-case") return;
  const steps = onboarding.steps.map((step) => step.screenPath);
  assert.equal(
    steps.indexOf("design/email/sign-in"),
    steps.indexOf("product/account/magic-link") + 1,
  );
  const invitation = byId.get("flows/product-invitation");
  assert.ok(invitation?.kind === "use-case");
  if (invitation?.kind !== "use-case") return;
  assert.deepEqual(
    invitation.steps.map((step) => step.screenPath),
    [
      "product/settings/members",
      "design/email/invitation",
      "product/account/sign-in",
      "product/account/invitation-accept",
    ],
  );
  assert.equal(invitation.path, "flows/product-invitation");
  for (const flow of [onboarding, invitation])
    for (const step of flow.steps) {
      const screen = byId.get(step.screenPath);
      assert.ok(
        screen?.kind === "screen" && screen.useCasePaths.includes(flow.path),
        flow.path + " " + step.screenPath,
      );
    }
});
