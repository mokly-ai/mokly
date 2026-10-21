import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import createCache from "@emotion/cache";
import * as emotion from "@emotion/react";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as styled from "styled-components";

import { AuthoringRuntime } from "../packages/mokly/src/authoring/runtime.js";
import { collectStyles } from "../packages/mokly/src/sidecar/styles.js";

const runtime = new AuthoringRuntime(React);
const generation = {
  runtime,
  exports: { entries: {}, stories: {}, styleAdapters: { emotion, styled } },
  require: createRequire(import.meta.url),
};
function Owner({
  name,
  children,
  capture,
}: {
  name: string;
  children: React.ReactNode;
  capture: boolean;
}) {
  const styles = React.useContext(runtime.contexts.styles);
  return capture && styles ? styles.wrap(name, children) : children;
}

test("ownership retains a consumer Emotion cache key and its inline CSS", () => {
  const render = (capture: boolean) =>
    collectStyles(
      generation,
      renderToStaticMarkup,
      React.createElement(
        emotion.CacheProvider,
        { value: createCache({ key: "product" }) },
        React.createElement(Owner, {
          name: "card",
          capture,
          children: emotion.jsx("div", {
            css: emotion.css`color:red`,
            children: "Card",
          }),
        }),
      ),
    );
  const before = render(false),
    after = render(true);
  assert.equal(after.html, before.html);
  assert.deepEqual(
    after.styles.map((item) => item.css),
    before.styles.map((item) => item.css),
  );
});

const Styled = styled.styled.div`display:flex; color:red`;

test("consumer Emotion Global styles keep their component owner", () => {
  const result = collectStyles(
    generation,
    renderToStaticMarkup,
    React.createElement(
      emotion.CacheProvider,
      { value: createCache({ key: "product" }) },
      React.createElement(Owner, {
        name: "card",
        capture: true,
        children: React.createElement(emotion.Global, {
          styles: emotion.css`.card{color:red}`,
        }),
      }),
    ),
  );
  const match = result.html.match(
    /<style data-emotion="([^"]+)"[^>]*>(.*?)<\/style>/,
  );
  assert.ok(match);
  assert.deepEqual(
    result
      .inlineAttribution(match[2]!, [
        { name: "data-emotion", value: match[1]! },
      ])
      ?.flatMap((record) => record.owners),
    ["card"],
  );
});

test("ownership retains the consumer styled-components forwarding policy", () => {
  const render = (capture: boolean) =>
    collectStyles(
      generation,
      renderToStaticMarkup,
      React.createElement(
        styled.StyleSheetManager,
        {
          shouldForwardProp: (name: string) => name !== "title",
          enableVendorPrefixes: true,
        },
        React.createElement(Owner, {
          name: "card",
          capture,
          children: React.createElement(Styled, { title: "private" }, "Card"),
        }),
      ),
    );
  const before = render(false),
    after = render(true);
  assert.equal(after.html, before.html);
  assert.deepEqual(
    after.styles.map((item) => item.css),
    before.styles.map((item) => item.css),
  );
});

for (const order of [
  ["a", "b"],
  ["b", "a"],
]) {
  test(`shared Emotion keyframes keep both owners: ${order.join("/")}`, () => {
    const frames = emotion.keyframes`from{opacity:0}to{opacity:1}`;
    const css = emotion.css`animation:${frames} 1s`;
    const result = collectStyles(
      generation,
      renderToStaticMarkup,
      React.createElement(
        React.Fragment,
        null,
        ...order.map((name) =>
          React.createElement(Owner, {
            key: name,
            name,
            capture: true,
            children: emotion.jsx("div", { css, children: name }),
          }),
        ),
      ),
    );
    const records = result.styles.flatMap((sheet) => sheet.attribution ?? []);
    for (const keyframes of [false, true]) {
      const owners = records
        .filter((record) => record.css.includes("@keyframes") === keyframes)
        .flatMap((record) => record.owners)
        .sort();
      assert.deepEqual(owners, ["a", "b"]);
    }
  });
}

test("ownership does not replace a consumer styled-components sheet", () => {
  const render = (capture: boolean) => {
    const sheet = new styled.ServerStyleSheet();
    try {
      return collectStyles(
        generation,
        renderToStaticMarkup,
        React.createElement(
          styled.StyleSheetManager,
          { sheet: sheet.instance },
          React.createElement(Owner, {
            name: "card",
            capture,
            children: React.createElement(Styled, null, "Card"),
          }),
        ),
      );
    } finally {
      sheet.seal();
    }
  };
  const before = render(false),
    after = render(true);
  assert.equal(after.html, before.html);
  assert.deepEqual(
    after.styles.map((item) => item.css),
    before.styles.map((item) => item.css),
  );
});

const frames = styled.keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;
const Animated = styled.styled.div`animation:${frames} 1s`;
for (const order of [
  ["a", "b"],
  ["b", "a"],
]) {
  test(`shared styled keyframes keep both owners: ${order.join("/")}`, () => {
    const result = collectStyles(
      generation,
      renderToStaticMarkup,
      React.createElement(
        React.Fragment,
        null,
        ...order.map((name) =>
          React.createElement(Owner, {
            key: name,
            name,
            capture: true,
            children: React.createElement(Animated, null, name),
          }),
        ),
      ),
    );
    const records = result.styles.flatMap((sheet) => sheet.attribution ?? []);
    const owners = records
      .filter((record) => record.css.includes("@keyframes"))
      .flatMap((record) => record.owners)
      .sort();
    assert.deepEqual(owners, ["a", "b"]);
  });
}
