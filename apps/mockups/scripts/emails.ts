/** Render the reviewed email definitions into committed Postmark templates. */

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  invitationPlaceholderContent,
  placeholder,
  placeholderNames,
  signInPlaceholderContent,
} from "../../../docs/mockups/src/emails/content";
import { EmailDocument } from "../../../docs/mockups/src/emails/document";
import type { EmailDefinition } from "../../../docs/mockups/src/emails/document";
import { invitationEmail } from "../../../docs/mockups/src/emails/invitation";
import { signInEmail } from "../../../docs/mockups/src/emails/sign-in";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultOut = resolve(root, "crates/mkc-email-templates/templates");
const brandRoot = "{{siteOrigin}}/brand/";

function unescapedPlaceholders(value: string): string {
  for (const name of placeholderNames) {
    value = value.replaceAll(placeholder(name), "{{{" + name + "}}}");
  }
  return value;
}

/** The six generated files, keyed by their committed basename. */
export function emailTemplates(): Map<string, string> {
  const files = new Map<string, string>();
  function add<Content>(
    email: EmailDefinition<Content>,
    content: Content,
  ): void {
    const html =
      "<!doctype html>\n" +
      renderToStaticMarkup(
        createElement(EmailDocument<Content>, { brandRoot, content, email }),
      ) +
      "\n";
    files.set(
      `${email.kind}.subject.txt`,
      unescapedPlaceholders(email.subject(content)) + "\n",
    );
    files.set(
      `${email.kind}.txt`,
      unescapedPlaceholders(email.text(content)) + "\n",
    );
    files.set(`${email.kind}.html`, html);
  }
  add(signInEmail, signInPlaceholderContent);
  add(invitationEmail, invitationPlaceholderContent);
  return files;
}

/** Write or byte-check all templates, rejecting obsolete files in check mode. */
export async function buildEmailTemplates(
  out: string,
  check: boolean,
): Promise<void> {
  const files = emailTemplates();
  if (check) {
    const actual = await readdir(out);
    const expected = [...files.keys()].sort();
    if (actual.sort().join("\n") !== expected.join("\n")) {
      throw new Error(
        `Email template file list differs; run npm run emails:build`,
      );
    }
    for (const [name, expectedText] of files) {
      const actualText = await readFile(resolve(out, name), "utf8");
      if (actualText !== expectedText) {
        const expectedLines = expectedText.split("\n");
        const actualLines = actualText.split("\n");
        const firstDifference = expectedLines.findIndex(
          (line, index) => line !== actualLines[index],
        );
        const line =
          firstDifference < 0 ? expectedLines.length + 1 : firstDifference + 1;
        throw new Error(
          `${name} differs at line ${line}; run npm run emails:build`,
        );
      }
    }
    return;
  }
  await mkdir(out, { recursive: true });
  for (const [name, content] of files) {
    await writeFile(resolve(out, name), content);
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const outIndex = args.indexOf("--out");
  if (
    args.some(
      (arg, index) =>
        arg !== "--check" &&
        arg !== "--out" &&
        (outIndex < 0 || index !== outIndex + 1),
    )
  ) {
    throw new Error("Usage: emails.ts [--check] [--out DIRECTORY]");
  }
  if (outIndex >= 0 && !args[outIndex + 1]) {
    throw new Error("--out requires a directory");
  }
  await buildEmailTemplates(
    outIndex >= 0 ? resolve(args[outIndex + 1]) : defaultOut,
    check,
  );
}
