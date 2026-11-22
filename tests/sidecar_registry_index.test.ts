import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as native from "react-native-web";

import { AuthoringRuntime } from "../packages/mokly/src/authoring/runtime.js";
import { HtmlInput } from "../packages/mokly/src/sidecar/html_input.js";
import { RegistryIndex } from "../packages/mokly/src/sidecar/registry-index.js";
import { registryStyles } from "../packages/mokly/src/sidecar/registry-styles.js";
import { collectStyles } from "../packages/mokly/src/sidecar/styles.js";

const runtime = new AuthoringRuntime(React);
const exports = { entries: {}, stories: {}, styleAdapters: { native } };
const require = createRequire(import.meta.url);
const application = "__mokly_sidecar_styles__";

/** The registry text, read from the style element as `collectStyles` reads it. */
function registryText(): string {
  native.AppRegistry.registerComponent(application, () => () => null);
  const element =
    native.AppRegistry.getApplication(application).getStyleElement();
  const props: unknown = React.isValidElement(element)
    ? element.props
    : undefined;
  const inner: unknown =
    props && typeof props === "object" && "dangerouslySetInnerHTML" in props
      ? props.dangerouslySetInnerHTML
      : undefined;
  if (
    inner &&
    typeof inner === "object" &&
    "__html" in inner &&
    typeof inner.__html === "string"
  )
    return inner.__html;
  throw new Error("react-native-web wrote no style element");
}

/** A fragment with every class name of the registry. */
function everyClass(): React.ReactNode {
  const names = new Set(
    [...registryText().matchAll(/\.([\w-]+)/g)].map((match) => match[1]),
  );
  return React.createElement("div", { className: [...names].join(" ") });
}

/** Run the fragments, then in reverse, then again, so later calls hit the memo. */
function repeated<T>(items: readonly T[]): T[] {
  return [...items, ...items.toReversed(), ...items];
}

test("the indexed filter writes the bytes of registryStyles for react-native-web registries", () => {
  const index = new RegistryIndex();
  const generation = { runtime, exports, require, registryIndex: index };
  const expected = new Set<string>();
  const compare = (round: string, fragments: [string, React.ReactNode][]) => {
    expected.clear();
    for (const [name, node] of repeated(fragments)) {
      const collected = collectStyles(generation, renderToStaticMarkup, node);
      const direct = registryStyles(registryText(), collected.input);
      assert.deepEqual(
        collected.styles,
        direct ? [{ css: direct, owners: [] }] : [],
        `${round}: ${name}`,
      );
      if (direct) expected.add(direct);
    }
  };
  // Before any consumer style, the registry is the sheet that
  // react-native-web writes when it loads, with its keyframes.
  compare("bare registry", [
    ["no class rule", React.createElement("p", null, "plain")],
    ["view", React.createElement(native.View)],
    ["text", React.createElement(native.Text, null, "text")],
    ["keyframes", React.createElement(native.ActivityIndicator)],
    ["placeholder", React.createElement(native.TextInput)],
    ["every class", everyClass()],
  ]);
  const atomic = native.StyleSheet.create(
    Object.fromEntries(
      Array.from({ length: 30 }, (_, item) => [
        `atomic${item}`,
        {
          backgroundColor: `rgb(${item},${item + 1},${item + 2})`,
          borderRadius: (item % 7) + 1,
          marginTop: item + 1,
          paddingHorizontal: item,
        },
      ]),
    ),
  );
  const styles = native.StyleSheet.create({
    pulse: {
      animationDuration: "1s",
      animationKeyframes: [{ from: { opacity: 0 }, to: { opacity: 1 } }],
    },
    passThrough: { pointerEvents: "box-none" },
  });
  const view = (...style: unknown[]) =>
    React.createElement(native.View, { style });
  compare("grown registry", [
    ["no class rule", React.createElement("p", null, "plain")],
    ["one atomic style", view(atomic.atomic3)],
    ["two atomic styles", view(atomic.atomic1, atomic.atomic29)],
    ["consumer keyframes", view(styles.pulse, atomic.atomic3)],
    ["child selector", view(styles.passThrough)],
    ["every class", everyClass()],
  ]);
  assert.deepEqual([...index.texts.keys()], [registryText()]);
  assert.deepEqual(
    new Set(index.texts.get(registryText())?.outputs.values()),
    expected,
  );
});

const registries: [string, string, string[]][] = [
  [
    "nested at-rules",
    "html{margin:0}@media (min-width:1px){@supports (display:grid){.grid{display:grid}.unused{color:blue}}.wide{width:100%}}@layer base{.base{color:red}.other{color:green}}@media print{.print{color:black}}@media screen{}",
    ["", "grid", "wide base", "grid unused wide base other print"],
  ],
  [
    "dependencies",
    '@font-face{font-family:"Brand";src:url(brand.woff2)}@font-face{font-family:Unused;src:url(unused.woff2)}@font-face{src:url(nameless.woff2)}' +
      "@property --size{syntax:'<length>';inherits:false;initial-value:1px}@property --unused{syntax:'*';inherits:true}" +
      '@keyframes spin{from{transform:rotate(0)}to{transform:rotate(1turn)}}@-webkit-keyframes spin{to{opacity:0}}@keyframes "quoted"{to{font-family:Brand}}@KEYFRAMES upper{to{opacity:1}}@keyframes unused{to{opacity:1}}' +
      "@media (min-width:1px){@keyframes inner{to{opacity:0}}.wide{color:red}}" +
      ".spin{animation:spin 1s linear}.quoted{animation-name:quoted}.sized{width:var(--size)}.prefixed{width:var(--size-extra,2px)}.brand{font-family:Brand,serif}.upper{animation:2s upper}.inner{animation:inner 1s}",
    [
      "",
      "spin",
      "quoted",
      "sized",
      "prefixed",
      "brand upper",
      "inner",
      "spin quoted sized prefixed brand upper inner wide",
    ],
  ],
  [
    "escaped and compound selectors",
    ".a\\:b{color:red}.sm\\:p-4{padding:4px}.w-1\\/2{width:50%}.\\31 23{color:blue}.\\@container{color:teal}.caf\\e9 {color:brown}" +
      '.a\\:b.c{color:green}.d,.e .f{color:pink}.g:not(.h){color:gray}[data-x=".y"]{color:olive}*{box-sizing:border-box}',
    [
      "",
      "a:b",
      "sm:p-4 w-1/2",
      "123 @container café",
      "a:b c d",
      "e f g h y",
      "a:b sm:p-4 w-1/2 123 @container café c d e f g h y",
    ],
  ],
  [
    "comments, whitespace, and nesting",
    '\n  /* lead */\n@charset "utf-8";\n@import url(x.css);\n.first{color:red}\n  .second{color:blue}\n/* mid */\n' +
      "@media screen{\n  /* inside */\n  .third{color:green}\n  .fourth{color:navy}\n}\n" +
      ".nest{color:red;.inner{color:blue}}\n.outer .x{.y{color:pink}}\n@layer a, b;\n@media print{}\n  \n",
    [
      "",
      "second",
      "third",
      "fourth",
      "inner",
      "nest inner",
      "outer x y",
      "first second third fourth nest inner outer x y",
    ],
  ],
];

test("the indexed filter writes the bytes of registryStyles for hand-written registries", () => {
  const index = new RegistryIndex();
  for (const [name, css, fragments] of repeated(registries))
    for (const classes of repeated(fragments)) {
      const input = new HtmlInput(`<p>text</p><i class="${classes}"></i>`);
      assert.equal(
        index.styles(css, input),
        registryStyles(css, input),
        `${name}: "${classes}"`,
      );
    }
  assert.deepEqual([...index.texts.keys()], [registries.at(-1)?.[1]]);
});
