import assert from "node:assert/strict";

import {
  byClass,
  elements,
  textContent,
  type Element,
} from "./design_catalogue.js";
import { children } from "./design_stacks.js";

/** One listed stylesheet: its path, then each nested lead with its selectors. */
export type StylesheetGroup = [
  path: string,
  outcomes: [lead: string, selectors: string[]][],
];

/** The file lead above a mockup card's stylesheet list, and that list. */
export interface StylesheetGroups {
  lead: string;
  files: StylesheetGroup[];
}

/** The text a list item holds directly, without its nested evidence. */
function ownText(item: Element): string {
  return item.childNodes
    .map((node) => ("value" in node ? node.value : ""))
    .join("")
    .trim();
}

/**
 * Read a card's stylesheet evidence back as it is grouped: each file once,
 * with the sentences and selectors that sit under that file.
 */
export function stylesheetGroups(
  card: Element,
  where: string,
): StylesheetGroups {
  const [list, ...others] = byClass(card, "mbk-evidence-files");
  assert.ok(list, `${where}: missing the stylesheet list`);
  assert.equal(others.length, 0, `${where}: one stylesheet list`);
  const parent = list.parentNode;
  assert.ok(parent && "childNodes" in parent, where);
  const siblings = parent.childNodes.filter(
    (node): node is Element => "tagName" in node,
  );
  const lead = siblings[siblings.indexOf(list) - 1];
  assert.equal(lead?.tagName, "p", `${where}: a lead sentence names the list`);
  const files = children(list).map((item): StylesheetGroup => {
    assert.equal(item.tagName, "li", where);
    const outcomes: [string, string[]][] = [];
    for (const child of children(item)) {
      if (child.tagName === "p") {
        outcomes.push([textContent(child).trim(), []]);
        continue;
      }
      assert.equal(child.tagName, "ul", `${where}: ${child.tagName}`);
      const outcome = outcomes.at(-1);
      assert.ok(outcome, `${where}: selectors follow their sentence`);
      outcome[1].push(
        ...elements(child, (node) => node.tagName === "code").map((code) =>
          textContent(code),
        ),
      );
    }
    return [ownText(item), outcomes];
  });
  return { lead: textContent(lead).trim(), files };
}
