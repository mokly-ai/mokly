import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { parse } from "parse5";

import { causeSentence, elisionText } from "../fixtures/build-copy";
import { builds, shortSha } from "../fixtures/builds";

import { drawings } from "./build-drawings";
import { screenFile } from "./catalogue-paths";
import {
  attribute,
  byClass,
  childElements,
  elements,
  label,
} from "./design-site-test-helpers";

test("each build failure selects its recovery sentence", () => {
  for (const [cause, step, sentence] of [
    ["exit", "install", "Installing dependencies failed."],
    ["exit", "publish", "The catalogue couldn’t be built."],
    ["upload-rejected", "publish", "Mokly couldn’t accept this catalogue."],
    [
      "unsupported-lockfile",
      "install",
      "Mokly installs with npm, pnpm or Yarn.",
    ],
    [
      "unsupported-mokly-version",
      "publish",
      "Update `@mokly/mokly` to 0.18.0 or later to publish.",
    ],
    [
      "uncommitted-changes",
      "publish",
      "The build left files that Git doesn’t ignore; add them to .gitignore.",
    ],
    [
      "output-limit",
      "publish",
      "The build printed too much output; print less to publish.",
    ],
    ["deadline", "publish", "The build stopped at its 60-minute limit."],
    ["idle", "publish", "The build stopped after going quiet."],
    ["infrastructure", "checkout", "Mokly couldn’t run this build."],
    [
      "repository-unavailable",
      "checkout",
      "Mokly can’t reach this repository; check the GitHub installation.",
    ],
    ["plan-required", null, undefined],
  ] as const)
    assert.equal(
      causeSentence({ ...builds.failed, cause, step }),
      sentence,
      cause,
    );
  assert.equal(causeSentence(builds.running), undefined);
});

test("each build drawing draws its state's title, line, steps and one action", () => {
  for (const drawing of drawings)
    for (const viewport of ["mobile", "desktop"] as const)
      for (const scheme of ["light", "dark"] as const) {
        const where = drawing.path + " " + viewport + " " + scheme;
        const page = parse(
          readFileSync(screenFile(drawing.path, viewport, scheme), "utf8"),
        );
        const [card, ...others] = byClass(page, "fo-build");
        assert.ok(card && others.length === 0, where + " draws one card");
        const title = byClass(card, "fo-state-title")[0];
        assert.equal(label(title), drawing.title);
        // The title is the focus target Cancel hands focus to, out of the tab
        // order, as in the application.
        assert.equal(attribute(title, "tabindex"), "-1", where);
        assert.equal(
          label(byClass(card, "fo-build-reference")[0]),
          (drawing.build.reference.kind === "branch"
            ? drawing.build.reference.name
            : drawing.build.reference.number +
              " " +
              drawing.build.reference.title) + shortSha(drawing.build),
          where,
        );
        const line = byClass(card, "fo-build-line")[0];
        assert.equal(line && label(line), drawing.line, where);
        const failed =
          drawing.build.state === "failed" ||
          drawing.build.state === "timed-out";
        // A failure announces its title and line and nothing else: the
        // reference, the action and any refusal beside it stay outside the
        // alert, so a control that changes its label never repeats it.
        const [message, ...messages] = byClass(card, "fo-build-message");
        assert.ok(message && messages.length === 0, where + " one message");
        assert.equal(
          attribute(message, "role"),
          failed ? "alert" : undefined,
          where,
        );
        assert.deepEqual(
          childElements(message).map((node) => [
            attribute(node, "class"),
            label(node),
          ]),
          [
            ["fo-state-title", drawing.title],
            ...(drawing.line ? [["fo-build-line", drawing.line]] : []),
          ],
          where,
        );
        // A refused request is announced on its own, beside the control.
        const alerts = elements(
          card,
          (node) => attribute(node, "role") === "alert",
        );
        assert.equal(
          alerts.length,
          (failed ? 1 : 0) + (drawing.refusal ? 1 : 0),
          where + " alerts",
        );
        assert.ok(!failed || alerts[0] === message, where + " alert");
        // The reference follows the message, so the head's grid can set it
        // between the title and the line without the alert holding it.
        assert.deepEqual(
          childElements(byClass(card, "fo-build-summary")[0]).map((node) =>
            attribute(node, "class"),
          ),
          ["fo-build-message", "fo-build-reference"],
          where,
        );
        const buttons = elements(card, (node) =>
          (attribute(node, "data-testid") ?? "").startsWith("firna-button-"),
        );
        const links = byClass(card, "fo-site-link");
        const action = drawing.action;
        // The CI setup guide is a link only where it is the card's one action;
        // a refusal never adds it.
        const guide = action?.kind === "link" ? action : undefined;
        assert.deepEqual(
          buttons.map((button) => [
            label(button),
            attribute(button, "data-testid"),
          ]),
          action?.kind === "button"
            ? [[action.label, "firna-button-" + action.tone]]
            : [],
          where,
        );
        assert.deepEqual(
          links.map((link) => [
            label(link),
            attribute(link, "href"),
            attribute(link, "target"),
            attribute(link, "rel"),
          ]),
          guide
            ? [[guide.label, guide.href, "_blank", "noopener noreferrer"]]
            : [],
          where,
        );
        // An action that leads somewhere is a link. A refused request leads
        // where it did only when the same request could succeed, a control
        // whose request runs leads nowhere until it answers, and a card
        // that offers its reader nothing draws no action column at all. An
        // action that waits for its reader leads nowhere: its column holds
        // the action's one placeholder.
        const places = byClass(card, "fo-build-action");
        const waits = action?.kind === "placeholder";
        const leads =
          !waits &&
          drawing.busy === undefined &&
          (drawing.refusal === undefined ||
            drawing.refusal.opens !== undefined);
        if (action === undefined) assert.equal(places.length, 0, where);
        else
          assert.ok(
            places.length === 1 &&
              elements(places[0], (node) => node.tagName === "a").length ===
                (leads ? 1 : 0) &&
              byClass(places[0], "fo-wait-control").length === (waits ? 1 : 0),
            where + " holds its one action beside the message",
          );
        assert.deepEqual(
          byClass(card, "fo-build-step-state").map(label),
          drawing.steps,
          where,
        );
        const current = elements(
          card,
          (node) => attribute(node, "aria-current") === "step",
        ).map((node) => label(byClass(node, "fo-build-step-name")[0]));
        assert.equal(
          current.length,
          drawing.steps.filter((step) =>
            ["Running", "Failed", "Stopped"].includes(step),
          ).length,
          where,
        );
        const lines = byClass(card, "fo-build-lines")[0];
        assert.equal(
          lines === undefined,
          drawing.build.output.length === 0,
          where,
        );
        if (lines === undefined) continue;
        // The output box is a region named by its Output label, which a
        // keyboard reader focuses to scroll.
        const [output] = byClass(card, "fo-build-output");
        const [heading] = byClass(output, "fo-group-label");
        const [log] = byClass(output, "fo-build-log");
        assert.deepEqual(
          [
            label(heading),
            attribute(log, "role"),
            attribute(log, "aria-labelledby"),
            attribute(log, "tabindex"),
            attribute(output, "aria-labelledby"),
          ],
          ["Output", "region", attribute(heading, "id"), "0", undefined],
          where,
        );
        assert.deepEqual(
          lines.childNodes.map((node) =>
            "tagName" in node
              ? [attribute(node, "class"), label(node)]
              : ["text", ""],
          ),
          drawing.build.output.map((entry) =>
            "elided" in entry
              ? ["fo-build-elision", elisionText(entry.elided)]
              : [
                  "fo-build-" + entry.stream,
                  entry.text.replace(/\s+/g, " ").trim(),
                ],
          ),
          where,
        );
      }
});

test("a reviewer's queued or running build is the owner's card without Cancel", () => {
  const drawn = (path: string) =>
    drawings.find((drawing) => drawing.path === path);
  for (const [ownerPath, reviewerPath] of [
    [
      "product/viewer/standalone/build/empty",
      "product/viewer/standalone/build/reader/queued",
    ],
    [
      "product/viewer/standalone/build",
      "product/viewer/standalone/build/reader/running",
    ],
  ] as const) {
    const owner = drawn(ownerPath);
    const reviewer = drawn(reviewerPath);
    assert.ok(owner && reviewer, reviewerPath);
    const { action, ...body } = owner;
    assert.deepEqual(
      action,
      { kind: "button", label: "Cancel", tone: "secondary" },
      ownerPath,
    );
    assert.deepEqual(reviewer, { ...body, path: reviewer.path }, reviewerPath);
  }
});
