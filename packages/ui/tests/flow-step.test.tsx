import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";

import { FlowStage, FlowStep } from "../src/flow-step/flow-step.js";

test("the flow's stage holds its steps in one column that keeps its scroll", () => {
  assert.equal(
    renderToStaticMarkup(
      <FlowStage>
        <i>step</i>
      </FlowStage>,
    ),
    '<div class="mbk-flow mbk-reset" data-mokly-scroll="flow"><div class="flow-track mbk-reset"><i>step</i></div></div>',
  );
});

test("a step names its number, title, description, and screen, then shows the preview", () => {
  // renderToString keeps the text nodes of the link apart, as the shell
  // renders them.
  assert.equal(
    renderToString(
      <FlowStep
        description="The landing screen."
        number={1}
        screen={{ href: "/view/home/", title: "Home" }}
        title="Start"
      >
        <i>preview</i>
      </FlowStep>,
    ),
    '<section class="flow-step mbk-reset"><div class="flow-step-head mbk-reset"><span class="flow-step-num mbk-reset">1</span><div class="mbk-reset"><h3 class="mbk-reset">Start</h3><p class="mbk-reset">The landing screen.</p><a class="flow-step-link mbk-reset" href="/view/home/">This screen in the catalogue: <!-- -->Home<!-- --> →</a></div></div><i>preview</i></section>',
  );
});

test("the step's heading and link are what the reader finds", () => {
  render(
    <FlowStep number={2} screen={{ href: "/view/b/", title: "B" }} title="Go">
      <i />
    </FlowStep>,
  );
  assert.equal(screen.getByRole("heading", { level: 3 }).textContent, "Go");
  assert.equal(
    screen
      .getByRole("link", { name: "This screen in the catalogue: B →" })
      .getAttribute("href"),
    "/view/b/",
  );
  assert.equal(screen.getByText("2").className, "flow-step-num mbk-reset");
});

test("a step without a screen has no link, no preview, and an empty description", () => {
  assert.equal(
    renderToStaticMarkup(<FlowStep number={3} title="missing/screen" />),
    '<section class="flow-step mbk-reset"><div class="flow-step-head mbk-reset"><span class="flow-step-num mbk-reset">3</span><div class="mbk-reset"><h3 class="mbk-reset">missing/screen</h3><p class="mbk-reset"></p></div></div></section>',
  );
});
