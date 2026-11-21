import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { type DefaultTreeAdapterMap, parse } from "parse5";

import { GUIDE_CONTENT } from "../src/docs/pages.js";
import { INSTALL_COMMAND } from "../src/docs/version.js";
import { sitePath } from "../src/workspace.js";

import {
  attribute,
  byClass,
  elements,
  one,
  textContent,
} from "./helpers/html.js";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];

interface Expected {
  readonly language: string;
  readonly prompt: boolean;
  readonly text: string;
}

/** One built page of the site, parsed. */
function built(...route: readonly string[]): Node {
  return parse(readFileSync(sitePath("dist", ...route, "index.html"), "utf8"));
}

/** The first fence of one language in an installed guide, as written. */
function fence(guide: string, language: string): string {
  const source = readFileSync(path.join(GUIDE_CONTENT, guide), "utf8");
  const match = new RegExp(
    `^\`\`\`${language}\\n([\\s\\S]*?)\\n\`\`\`$`,
    "mu",
  ).exec(source);
  assert.ok(match?.[1], `${guide} has a ${language} fence`);
  return match[1];
}

function classList(node: Node): string[] {
  return "tagName" in node ? (attribute(node, "class")?.split(" ") ?? []) : [];
}

function children(node: Element): Node[] {
  return node.childNodes;
}

/** The one panel whose open tab names the language. */
function panel(page: Node, language: string): Element {
  const found = byClass(page, "site-code").filter(
    (candidate) => textContent(one(candidate, "site-code-tab")) === language,
  );
  assert.equal(found.length, 1, `one ${language} panel`);
  return found[0]!;
}

/**
 * An ordinary panel: the prompt modifier only on a shell, never the numbered
 * one; a head of the open tab, which names the language, and the copy slot;
 * and a body whose code holds only its lines, whose text is the source.
 */
function assertPanel(panel: Element, expected: Expected): void {
  const name = expected.language;
  assert.deepEqual(
    classList(panel),
    expected.prompt ? ["site-code", "site-code--prompt"] : ["site-code"],
    name,
  );
  const head = one(panel, "site-code-head");
  assert.deepEqual(
    children(head).map(classList),
    [
      ["site-code-tab", "site-code-tab--open", "site-code-language"],
      ["site-code-copy-slot"],
    ],
    name,
  );
  assert.equal(textContent(one(head, "site-code-tab")), name);
  const pre = elements(panel, (element) => element.tagName === "pre");
  assert.equal(pre.length, 1, name);
  assert.ok(classList(pre[0]!).includes("site-code-body"), name);
  const [code, ...rest] = children(pre[0]!);
  assert.equal(rest.length, 0, name);
  assert.ok(code && "tagName" in code && code.tagName === "code", name);
  const lines = children(code);
  assert.equal(lines.length, expected.text.split("\n").length, name);
  for (const line of lines)
    assert.ok(classList(line).includes("site-code-line"), `${name}: a line`);
  assert.equal(textContent(code), expected.text, name);
}

test("a guide renders its shell fence with the prompt and its other fences without it", () => {
  const page = built("docs", "start", "your-first-screen");
  const guide = "start/your-first-screen.md";
  assertPanel(panel(page, "sh"), {
    language: "sh",
    prompt: true,
    text: fence(guide, "sh"),
  });
  assertPanel(panel(page, "tsx"), {
    language: "tsx",
    prompt: false,
    text: fence(guide, "tsx"),
  });
});

test("the landing's install snippet renders the shell panel of a guide", () => {
  const panels = byClass(built("docs"), "site-code");
  assert.equal(panels.length, 1);
  assertPanel(panels[0]!, {
    language: "shell",
    prompt: true,
    text: INSTALL_COMMAND,
  });
});
