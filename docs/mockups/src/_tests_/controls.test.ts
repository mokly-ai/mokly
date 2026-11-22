import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { Avatar } from "@firna/ui/avatar";
import { Badge } from "@firna/ui/badge";
import { Button } from "@firna/ui/button";
import { Input } from "@firna/ui/input";
import { StatusDot } from "@firna/ui/status-dot";
import { createElement, isValidElement } from "react";
import type { ElementType, ReactNode } from "react";

import { avatarInput } from "../components/avatar";
import { badgeInput } from "../components/badge";
import { buttonInput } from "../components/button";
import { inputInput } from "../components/input";
import { statusDotInput } from "../components/status-dot";

import { wrapperMarkup } from "./wrapper-markup";

const context = { viewport: "desktop", colorScheme: "light" } as const;

/**
 * One closed JSON Schema prop schema in the form that the registrations
 * fixture records, the schema language of Mokly 0.14.0: an object of
 * `{ schema, optional }` properties, and `string`, `boolean` and `enum`
 * kinds. A property that `required` does not name is optional.
 */
function recordedSchema(schema: unknown): unknown {
  assert.ok(typeof schema === "object" && schema !== null);
  const node = new Map<string, unknown>(Object.entries(schema));
  const values = node.get("enum");
  if (values !== undefined) return { kind: "enum", values };
  const kind = node.get("type");
  if (kind !== "object") {
    assert.ok(kind === "string" || kind === "boolean", String(kind));
    return { kind };
  }
  const properties = node.get("properties");
  const required = node.get("required") ?? [];
  assert.ok(typeof properties === "object" && properties !== null);
  assert.ok(Array.isArray(required));
  return {
    kind: "object",
    properties: Object.fromEntries(
      Object.entries(properties).map(([name, property]) => [
        name,
        {
          schema: recordedSchema(property),
          ...(required.includes(name) ? {} : { optional: true }),
        },
      ]),
    ),
  };
}

function containsComponent(node: ReactNode, type: ElementType): boolean {
  if (Array.isArray(node))
    return node.some((child) => containsComponent(child, type));
  if (!isValidElement<{ children?: ReactNode }>(node)) return false;
  return node.type === type || containsComponent(node.props.children, type);
}

test("registered control renderers contain actual Firna components", () => {
  const cases: [ReactNode, ElementType][] = [
    [
      buttonInput.render({ label: "Continue", tone: "primary" }, context),
      Button,
    ],
    [
      inputInput.render(
        { label: "Email", name: "email", type: "email" },
        context,
      ),
      Input,
    ],
    [badgeInput.render({ label: "Approved", tone: "success" }, context), Badge],
    [avatarInput.render({ label: "Sam", tone: "soft" }, context), Avatar],
    [statusDotInput.render({ tone: "success" }, context), StatusDot],
  ];
  for (const [node, component] of cases) {
    assert.ok(containsComponent(node, component));
    assert.equal(
      containsComponent(
        createElement("span", { "data-testid": "firna-control" }),
        component,
      ),
      false,
    );
  }
});

test("the adoption preserves existing registration schemas, controls and saved variants", () => {
  const inputs = [buttonInput, inputInput, badgeInput];
  const preserved = inputs.map(
    ({ propSchema, controls, variants, slots }, index) => ({
      path: ["design/button", "design/input", "design/badge"][index],
      propSchema: recordedSchema(propSchema),
      controls,
      variants,
      slots,
    }),
  );
  const fixture = JSON.parse(
    readFileSync(
      new URL("./fixtures/control-registrations.json", import.meta.url),
      "utf8",
    ),
  );
  const compatible = JSON.parse(JSON.stringify(preserved));
  const badge = compatible.find(
    (item: { path: string }) => item.path === "design/badge",
  );
  assert.deepEqual(badge.propSchema.properties.dot, {
    schema: { kind: "boolean" },
    optional: true,
  });
  delete badge.propSchema.properties.dot;
  delete badge.controls.dot;
  const field = compatible.find(
    (item: { path: string }) => item.path === "design/input",
  );
  assert.equal(
    field.propSchema.properties.type.schema.values.pop(),
    "identifier",
  );
  assert.deepEqual(field.controls.type.options.pop(), {
    label: "Identifier",
    value: "identifier",
  });
  assert.deepEqual(field.propSchema.properties.placeholder, {
    schema: { kind: "string" },
    optional: true,
  });
  delete field.propSchema.properties.placeholder;
  delete field.controls.placeholder;
  assert.equal(field.variants[0].props.placeholder, "sam@example.com");
  delete field.variants[0].props.placeholder;
  // The waiting form a wait draws: an optional flag, the slot that holds the
  // wait's name, and the saved variant that draws it.
  assert.deepEqual(field.propSchema.properties.waiting, {
    schema: { kind: "boolean" },
    optional: true,
  });
  delete field.propSchema.properties.waiting;
  delete field.controls.waiting;
  // A waiting label whose words hold a name the answer supplies: the bar's
  // width and the words after it, both required once the label waits.
  assert.deepEqual(field.propSchema.properties.labelWaits, {
    schema: {
      kind: "object",
      properties: {
        bar: { schema: { kind: "string" } },
        after: { schema: { kind: "string" } },
      },
    },
    optional: true,
  });
  delete field.propSchema.properties.labelWaits;
  assert.deepEqual(field.slots, ["hold"]);
  delete field.slots;
  assert.deepEqual(field.variants.pop(), {
    slug: "waiting",
    title: "Waiting",
    props: {
      label: "Email",
      name: "waiting-email",
      type: "email",
      waiting: true,
    },
  });
  const button = compatible.find(
    (item: { path: string }) => item.path === "design/button",
  );
  for (const added of [
    "block",
    "size",
    "icon",
    "chevron",
    "singleLine",
    "accessibilityLabel",
    "busy",
    "lead",
  ]) {
    assert.ok(button.propSchema.properties[added].optional, added);
    delete button.propSchema.properties[added];
    delete button.controls[added];
  }
  assert.equal(button.propSchema.properties.tone.schema.values.pop(), "danger");
  assert.deepEqual(button.controls.tone.options.pop(), {
    label: "Danger",
    value: "danger",
  });
  assert.deepEqual(button.variants.shift(), {
    slug: "danger",
    title: "Danger",
    props: { label: "Delete project", tone: "danger" },
  });
  assert.deepEqual(compatible, fixture);
});

test("static fields associate help and errors without controlled-value warnings", (t) => {
  const errors = t.mock.method(console, "error", () => {});
  for (const error of [undefined, "Enter a complete email address."]) {
    const node = inputInput.render(
      {
        label: "Email",
        name: "fixture-email",
        type: "email",
        value: "sam@",
        helper: "Use your work email.",
        error,
      },
      context,
    );
    const html = wrapperMarkup(node, context);
    assert.match(html, /aria-labelledby="[^"]+-label"/);
    assert.match(html, /aria-describedby="[^"]+-(?:hint|error)"/);
    assert.match(html, /id="fixture-email"/);
    assert.ok(html.includes(error ?? "Use your work email."));
    if (error) {
      assert.match(html, /aria-invalid="true"/);
      assert.match(html, /role="alert"/);
      assert.ok(!html.includes("Use your work email."));
    }
  }
  assert.equal(errors.mock.callCount(), 0);
});

test("identifier fields disable keyboard rewriting without changing prose fields", () => {
  const renderField = (type: "identifier" | "text") =>
    wrapperMarkup(
      inputInput.render(
        {
          label: type === "identifier" ? "Project slug" : "Project name",
          name: type,
          type,
          value: type === "identifier" ? "mokly-cloud" : "Mokly Cloud",
        },
        context,
      ),
      context,
    );

  const identifier = renderField("identifier");
  assert.match(identifier, /autoCapitalize="none"/);
  assert.match(identifier, /autoCorrect="off"/);
  assert.match(identifier, /spellCheck="false"/);

  const prose = renderField("text");
  assert.match(prose, /autoCapitalize="sentences"/);
  assert.match(prose, /autoCorrect="on"/);
  assert.match(prose, /spellCheck="true"/);
});
