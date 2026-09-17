import assert from "node:assert/strict";
import test from "node:test";

import { applyNavVisibility } from "../packages/viewer/dist/client/browse_navigation_state.js";
import {
  handleTagControlClick,
  handleTagPickerKeydown,
  syncTagChips,
} from "../packages/viewer/dist/client/tag_filter.js";

import { asDocument, asElement, FakeNode } from "./helpers/fake_dom.js";

test("a tag chip enters its term and filters the catalogue", () => {
  const shell = tagShell();

  assert.equal(
    handleTagControlClick(shell.doc, asElement(shell.formsGlyph)),
    true,
  );

  assert.equal(shell.search.value, "tag:forms");
  assert.equal(shell.search.dispatched[0]?.type, "input");
  assert.equal(shell.search.dispatched[0]?.bubbles, true);
  assert.equal(shell.welcomeRow.hidden, false);
  assert.equal(shell.detailsRow.hidden, false);
  assert.equal(shell.glossaryRow.hidden, true);
  assert.equal(shell.forms.classList.contains("active"), true);
  assert.equal(shell.onboarding.classList.contains("active"), false);
});

test("clicking the active chip clears only its tag term", () => {
  const shell = tagShell();
  shell.search.value = "welcome tag:forms";

  handleTagControlClick(shell.doc, asElement(shell.onboarding));
  assert.equal(shell.search.value, "welcome tag:onboarding");
  assert.equal(shell.forms.classList.contains("active"), false);
  assert.equal(shell.onboarding.classList.contains("active"), true);

  handleTagControlClick(shell.doc, asElement(shell.onboarding));
  assert.equal(shell.search.value, "welcome");
  assert.equal(shell.onboarding.classList.contains("active"), false);
});

test("chip state and clicks elsewhere follow the entered query", () => {
  const shell = tagShell();
  shell.search.value = "TAG:Onboarding";

  syncTagChips(shell.doc);
  assert.deepEqual(pressed(shell), {
    detailsForms: "false",
    detailsOnboarding: "true",
    pickerForms: "false",
    pickerOnboarding: "true",
  });
  assert.equal(shell.onboarding.classList.contains("active"), true);
  assert.equal(shell.pickerOnboarding.classList.contains("active"), true);
  assert.equal(shell.forms.classList.contains("active"), false);

  shell.search.value = "";
  syncTagChips(shell.doc);
  assert.equal(shell.onboarding.classList.contains("active"), false);
  assert.equal(shell.pickerOnboarding.getAttribute("aria-pressed"), "false");
  assert.equal(
    handleTagControlClick(shell.doc, asElement(shell.welcomeRow)),
    false,
  );
  assert.equal(shell.search.dispatched.length, 0);
});

test("the tag button opens and closes its picker", () => {
  const shell = tagShell();

  assert.equal(handleTagControlClick(shell.doc, asElement(shell.toggle)), true);
  assert.equal(shell.panel.hidden, false);
  assert.equal(shell.toggle.getAttribute("aria-expanded"), "true");
  assert.equal(shell.root.activeElement, shell.pickerBilling);
  assert.deepEqual(tabIndexes(shell), ["0", "-1", "-1"]);

  assert.equal(handleTagControlClick(shell.doc, asElement(shell.toggle)), true);
  assert.equal(shell.panel.hidden, true);
  assert.equal(shell.toggle.getAttribute("aria-expanded"), "false");
  assert.equal(shell.search.dispatched.length, 0);
});

test("opening the picker focuses the chip the query names", () => {
  const shell = tagShell();
  shell.search.value = "tag:onboarding";
  syncTagChips(shell.doc);

  handleTagControlClick(shell.doc, asElement(shell.toggle));

  assert.equal(shell.root.activeElement, shell.pickerOnboarding);
  assert.deepEqual(tabIndexes(shell), ["-1", "-1", "0"]);

  shell.search.value = "tag:billing";
  syncTagChips(shell.doc);
  assert.equal(shell.pickerBilling.getAttribute("aria-pressed"), "true");
  assert.deepEqual(tabIndexes(shell), ["-1", "-1", "0"]);
});

test("a chip chosen in the picker closes it and returns focus", () => {
  const shell = tagShell();
  handleTagControlClick(shell.doc, asElement(shell.toggle));

  assert.equal(
    handleTagControlClick(shell.doc, asElement(shell.pickerForms)),
    true,
  );

  assert.equal(shell.search.value, "tag:forms");
  assert.equal(shell.panel.hidden, true);
  assert.equal(shell.toggle.getAttribute("aria-expanded"), "false");
  assert.equal(shell.root.activeElement, shell.toggle);
  assert.equal(shell.glossaryRow.hidden, true);
  assert.equal(shell.pickerForms.getAttribute("aria-pressed"), "true");
});

test("an inspector chip never opens the picker and rescues focus from it", () => {
  const shell = tagShell();

  handleTagControlClick(shell.doc, asElement(shell.forms));
  assert.equal(shell.panel.hidden, true);
  assert.equal(shell.toggle.getAttribute("aria-expanded"), "false");
  assert.equal(shell.root.activeElement, null);

  handleTagControlClick(shell.doc, asElement(shell.toggle));
  assert.equal(shell.root.activeElement, shell.pickerForms);

  handleTagControlClick(shell.doc, asElement(shell.onboarding));
  assert.equal(shell.search.value, "tag:onboarding");
  assert.equal(shell.panel.hidden, true);
  assert.equal(shell.root.activeElement, shell.toggle);
});

test("Escape closes the picker and leaves the query alone", () => {
  const shell = tagShell();
  shell.search.value = "welcome tag:forms";
  syncTagChips(shell.doc);
  handleTagControlClick(shell.doc, asElement(shell.toggle));

  assert.equal(
    handleTagPickerKeydown(shell.doc, "Escape", asElement(shell.pickerForms)),
    true,
  );

  assert.equal(shell.panel.hidden, true);
  assert.equal(shell.toggle.getAttribute("aria-expanded"), "false");
  assert.equal(shell.root.activeElement, shell.toggle);
  assert.equal(shell.search.value, "welcome tag:forms");
  assert.equal(shell.search.dispatched.length, 0);
  assert.equal(
    handleTagPickerKeydown(shell.doc, "Escape", asElement(shell.toggle)),
    false,
  );
});

test("a click outside closes the picker without taking focus", () => {
  const shell = tagShell();
  handleTagControlClick(shell.doc, asElement(shell.toggle));

  assert.equal(
    handleTagControlClick(shell.doc, asElement(shell.panelHead)),
    false,
  );
  assert.equal(shell.panel.hidden, false);

  shell.welcomeRow.focus();
  assert.equal(
    handleTagControlClick(shell.doc, asElement(shell.welcomeRow)),
    false,
  );
  assert.equal(shell.panel.hidden, true);
  assert.equal(shell.toggle.getAttribute("aria-expanded"), "false");
  assert.equal(shell.root.activeElement, shell.welcomeRow);
});

test("arrow, Home, and End keys rove across the picker chips", () => {
  const shell = tagShell();
  handleTagControlClick(shell.doc, asElement(shell.toggle));

  assert.equal(moved(shell, "ArrowRight", shell.pickerBilling), true);
  assert.equal(shell.root.activeElement, shell.pickerForms);
  assert.deepEqual(tabIndexes(shell), ["-1", "0", "-1"]);

  moved(shell, "ArrowRight", shell.pickerForms);
  moved(shell, "ArrowRight", shell.pickerOnboarding);
  assert.equal(shell.root.activeElement, shell.pickerBilling);

  moved(shell, "ArrowLeft", shell.pickerBilling);
  assert.equal(shell.root.activeElement, shell.pickerOnboarding);

  moved(shell, "Home", shell.pickerOnboarding);
  assert.equal(shell.root.activeElement, shell.pickerBilling);

  moved(shell, "End", shell.pickerBilling);
  assert.equal(shell.root.activeElement, shell.pickerOnboarding);

  assert.equal(moved(shell, "Enter", shell.pickerOnboarding), false);
  assert.equal(moved(shell, " ", shell.pickerOnboarding), false);
  assert.equal(moved(shell, "ArrowRight", shell.forms), false);
  assert.equal(shell.root.activeElement, shell.pickerOnboarding);
});

/** The served tag controls over one filtered catalogue column: the inspector
 * chips, the search field's tag button, and the picker the button opens. */
interface TagShell {
  detailsRow: FakeNode;
  doc: Document;
  forms: FakeNode;
  formsGlyph: FakeNode;
  glossaryRow: FakeNode;
  onboarding: FakeNode;
  panel: FakeNode;
  panelHead: FakeNode;
  pickerBilling: FakeNode;
  pickerForms: FakeNode;
  pickerOnboarding: FakeNode;
  root: FakeNode;
  search: FakeNode;
  toggle: FakeNode;
  welcomeRow: FakeNode;
}

function tagShell(): TagShell {
  const search = new FakeNode("input", { "data-mokly-search": "" });
  const formsGlyph = new FakeNode("svg", { "aria-hidden": "true" });
  const forms = tagChip("forms").append(formsGlyph);
  const onboarding = tagChip("onboarding");
  const picker = ["billing", "forms", "onboarding"].map(tagChip);
  const panelHead = new FakeNode("div", { "data-head": "" }, "Tags");
  const panel = new FakeNode("div", { id: "mb-tag-picker" }).append(
    panelHead,
    ...picker,
  );
  panel.hidden = true;
  const toggle = new FakeNode("button", {
    "aria-controls": "mb-tag-picker",
    "aria-expanded": "false",
    "data-mokly-tag-toggle": "",
  });
  const welcomeRow = navRow(
    "screens/welcome.html",
    "Welcome",
    "forms onboarding",
  );
  const detailsRow = navRow("screens/details.html", "Details", "forms");
  const glossaryRow = navRow("docs/glossary.html", "Glossary");
  const root = new FakeNode("div").append(
    new FakeNode("div", { "data-search": "" }).append(search, toggle, panel),
    new FakeNode("details", { "data-mokly-details": "" }).append(
      forms,
      onboarding,
    ),
    new FakeNode("details", {
      "data-nav-collection": "collection:screens",
      "data-nav-disclosure": "collection:pages:screens",
    }).append(welcomeRow, detailsRow),
    new FakeNode("details", {
      "data-nav-collection": "collection:docs",
      "data-nav-disclosure": "collection:pages:docs",
    }).append(glossaryRow),
  );
  const doc = asDocument(root);
  search.onDispatch = () => {
    applyNavVisibility(doc, "reveal-matches");
    syncTagChips(doc);
  };
  return {
    detailsRow,
    doc,
    forms,
    formsGlyph,
    glossaryRow,
    onboarding,
    panel,
    panelHead,
    pickerBilling: picker[0]!,
    pickerForms: picker[1]!,
    pickerOnboarding: picker[2]!,
    root,
    search,
    toggle,
    welcomeRow,
  };
}

function moved(shell: TagShell, key: string, from: FakeNode): boolean {
  return handleTagPickerKeydown(shell.doc, key, asElement(from));
}

function pressed(shell: TagShell): Record<string, string | null> {
  return {
    detailsForms: shell.forms.getAttribute("aria-pressed"),
    detailsOnboarding: shell.onboarding.getAttribute("aria-pressed"),
    pickerForms: shell.pickerForms.getAttribute("aria-pressed"),
    pickerOnboarding: shell.pickerOnboarding.getAttribute("aria-pressed"),
  };
}

function tabIndexes(shell: TagShell): (string | null)[] {
  return [shell.pickerBilling, shell.pickerForms, shell.pickerOnboarding].map(
    (chip) => chip.getAttribute("tabindex"),
  );
}

function tagChip(tag: string): FakeNode {
  return new FakeNode(
    "button",
    { "aria-pressed": "false", "data-mokly-tag": tag },
    tag,
  );
}

function navRow(route: string, label: string, tags?: string): FakeNode {
  return new FakeNode(
    "a",
    {
      "data-nav-row": "",
      "data-route": route,
      href: `/view/${route}`,
      ...(tags === undefined ? {} : { "data-tags": tags }),
    },
    label,
  );
}
