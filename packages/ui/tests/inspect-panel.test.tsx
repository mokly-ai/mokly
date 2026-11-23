import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";

import {
  InspectHead,
  InspectRationale,
  InspectVariants,
} from "../src/inspect-panel/inspect-head.js";
import {
  InspectFold,
  InspectPanel,
  InspectSection,
} from "../src/inspect-panel/inspect-panel.js";
import { MetadataPath } from "../src/metadata-row/metadata-row.js";

test("the head names the entry, its kind and its status, then its description and rows", () => {
  render(
    <InspectHead
      component
      description="A shared action."
      status={<span>Changed</span>}
      title="Action"
    >
      <p>Path row</p>
    </InspectHead>,
  );
  const head = screen.getByRole("region", { name: "Details" });
  assert.equal(
    within(head).getByRole("heading", { level: 2 }).textContent,
    "Action",
  );
  assert.equal(
    head.textContent,
    "ActionComponentChangedA shared action.Path row",
  );
});

test("a section names itself with its count, and the rationale names the entry's kind", () => {
  render(
    <InspectPanel>
      <InspectRationale noun="screen" text="It anchors the catalogue." />
      <InspectSection count={4} label="Frames">
        <p>Filter</p>
      </InspectSection>
    </InspectPanel>,
  );
  assert.equal(
    screen.getByRole("region", { name: "Why this screen" }).textContent,
    "Why this screenIt anchors the catalogue.",
  );
  assert.equal(screen.getByRole("heading", { name: "Frames 4" }).tagName, "H3");
});

test("a folded section is a closed native disclosure with its count, which keeps its state", () => {
  const { container } = render(
    <InspectFold count={2} name="usage" title="Usage">
      <p>Used by</p>
    </InspectFold>,
  );
  const fold = container.querySelector("details")!;
  assert.equal(fold.open, false);
  assert.equal(fold.getAttribute("data-inspect-section"), "usage");
  assert.equal(fold.querySelector("summary")?.textContent, "Usage 2");
  fold.open = true;
  fireEvent(fold, new Event("toggle"));
  assert.equal(fold.open, true);
  assert.equal(within(fold).getByText("Used by").tagName, "P");
});

test("the variants list links each variant, a set's chooses one, and the current one is checked", () => {
  const chosen: string[] = [];
  render(
    <>
      <InspectVariants
        variants={[
          { current: true, href: "/view/welcome/", key: "w", label: "Welcome" },
          {
            current: false,
            href: "/view/welcome/empty/",
            key: "e",
            label: "Empty",
          },
        ]}
      />
      <InspectVariants
        variants={[
          {
            current: false,
            key: "a",
            label: "Action",
            onChoose: () => chosen.push("a"),
          },
          {
            current: true,
            key: "d",
            label: "Disabled",
            onChoose: () => chosen.push("d"),
          },
          { current: false, key: "p", label: "Picture" },
        ]}
      />
    </>,
  );
  const [links, set] = screen.getAllByRole("region", { name: "Variants" });
  assert.deepEqual(
    within(links!)
      .getAllByRole("link")
      .map((link) => [link.textContent, link.getAttribute("aria-current")]),
    [
      ["Welcome", "page"],
      ["Empty", null],
    ],
  );
  assert.equal(within(links!).getByRole("heading").textContent, "Variants 2");
  const buttons = within(set!).getAllByRole("button");
  assert.deepEqual(
    buttons.map((button) => button.getAttribute("aria-pressed")),
    ["false", "true"],
  );
  fireEvent.click(buttons[0]!);
  assert.deepEqual(chosen, ["a"]);
  assert.equal(within(set!).getByText("Picture").tagName, "SPAN");
});

test("a path's folder segments are breadcrumbs: a link, a reveal, then text", () => {
  const revealed: string[] = [];
  const { container } = render(
    <MetadataPath
      segments={[
        { href: "/view/example/", text: "example" },
        {
          folder: "example/screens",
          onReveal: () => revealed.push("screens"),
          text: "screens",
        },
        { text: "welcome" },
      ]}
    />,
  );
  assert.equal(container.textContent, "example/screens/welcome");
  assert.equal(
    screen.getByRole("link", { name: "example" }).getAttribute("href"),
    "/view/example/",
  );
  fireEvent.click(screen.getByRole("button", { name: "screens" }));
  assert.deepEqual(revealed, ["screens"]);
  assert.equal(container.querySelectorAll("wbr").length, 2);
});
