import assert from "node:assert/strict";
import test from "node:test";

import { CssSyntaxError } from "postcss";

import { HtmlInput } from "../packages/mokly/src/sidecar/html_input.js";
import { RegistryIndex } from "../packages/mokly/src/sidecar/registry-index.js";
import { registryStyles } from "../packages/mokly/src/sidecar/registry-styles.js";

function outcome(filter: () => string) {
  try {
    return { kind: "css", css: filter() } as const;
  } catch (error) {
    if (error instanceof Error)
      return {
        kind: "error",
        errorClass: error.constructor,
        message: error.message,
      } as const;
    return { kind: "thrown", value: error } as const;
  }
}

function compareRegistry(index: RegistryIndex, css: string, input: HtmlInput) {
  const actual = outcome(() => index.styles(css, input));
  const expected = outcome(() => registryStyles(css, input));
  assert.deepEqual(
    actual,
    expected,
    `registry ${JSON.stringify(css)}, fragment ${JSON.stringify(input.html)}`,
  );
  return actual;
}

test("the index uses registryStyles when registry analysis or parsing throws", () => {
  const index = new RegistryIndex();
  const css = ".a,.\\110000{color:red}";
  const matched = new HtmlInput('<i class="a"></i>');
  const unmatched = new HtmlInput("<i></i>");

  assert.deepEqual(compareRegistry(index, css, matched), {
    kind: "css",
    css: ".a,.\\110000{color:red}",
  });
  assert.partialDeepStrictEqual(compareRegistry(index, css, unmatched), {
    kind: "error",
    errorClass: RangeError,
  });
  assert.partialDeepStrictEqual(
    compareRegistry(index, ".a{color:red", matched),
    { kind: "error", errorClass: CssSyntaxError },
  );
});

interface Registry {
  readonly css: string;
  readonly classes: readonly string[];
}

const blocks: readonly Registry[] = [
  {
    css:
      ".a\\:b{color:red}.w-1\\/2{width:50%}.\\31 23{color:blue}" +
      ".\\@container{color:teal}.caf\\e9 {color:brown}.hex\\21{color:purple}" +
      '.\\0 {color:gray}.quote\\"\\&{color:black}',
    classes: [
      "a:b",
      "w-1/2",
      "123",
      "@container",
      "café",
      "hex!",
      "\uFFFD",
      'quote"&',
    ],
  },
  {
    css:
      "@keyframes spin{from{opacity:0}to{animation-name:tail}}" +
      "@keyframes tail{to{opacity:1}}@-webkit-keyframes spin{to{opacity:0}}" +
      ".spin{animation:spin 1s}",
    classes: ["spin"],
  },
  {
    css:
      '@keyframes "quoted"{to{font-family:Brand}}@KEYFRAMES upper{to{opacity:1}}' +
      "@media (min-width:1px){@keyframes inside{to{opacity:0}}}" +
      ".frames{animation-name:quoted,upper,inside}",
    classes: ["frames"],
  },
  {
    css:
      "@font-face{font-family:Brand;src:url(brand.woff2)}" +
      '@font-face{font-family:"Quoted";src:url(quoted.woff2)}' +
      "@font-face{src:url(unnamed.woff2)}" +
      "@font-face{font-family:First;font-family:Last;src:url(last.woff2)}" +
      '.named-font{font-family:Brand}.quoted-font{font-family:"Quoted"}' +
      ".first-font{font-family:First}.last-font{font-family:Last}",
    classes: ["named-font", "quoted-font", "first-font", "last-font"],
  },
  {
    css:
      '@property --size{syntax:"<length>";inherits:false;initial-value:var(--unit)}' +
      '@property --unit{syntax:"<length>";inherits:false;initial-value:1px}' +
      ".exact{width:var(--size)}.prefix{width:var(--size-extra,2px)}" +
      ".custom{--own:var(--size);width:var(--own)}",
    classes: ["exact", "prefix", "custom"],
  },
  {
    css:
      ".outer{color:red;.inner{font-family:Brand}}" +
      ".ancestor .descendant{.child{color:blue}}",
    classes: ["outer", "inner", "ancestor", "descendant", "child"],
  },
  {
    css: "html{margin:0}*{box-sizing:border-box}[role=alert]{color:darkred}",
    classes: [],
  },
  {
    css: '\n /* lead */\n@charset "utf-8";\n@import url("theme.css");\n@layer base, theme;\n@media print{}\n\t/* end */\n ',
    classes: [],
  },
  {
    css: "\n /* lead */\n .space{color:green}\n /* between */\n .tabs{color:blue}\n ",
    classes: ["space", "tabs"],
  },
];

const wrappers = [
  "@media screen",
  "@supports (display: grid)",
  "@layer base",
  "@container (width > 10px)",
];

function combine(registries: readonly Registry[]): Registry {
  return {
    css: registries.map(({ css }) => css).join("\n"),
    classes: [...new Set(registries.flatMap(({ classes }) => classes))],
  };
}

function* generatedRegistries(): Iterable<Registry> {
  yield* blocks;
  for (const first of blocks) {
    for (const second of blocks) yield combine([first, second]);
    for (const wrapper of wrappers)
      yield { css: `${wrapper} {\n${first.css}\n}`, classes: first.classes };
  }
  yield combine(blocks);
  yield combine(blocks.toReversed());
}

function fragment(classes: readonly string[]): HtmlInput {
  if (classes.length === 0) return new HtmlInput("<i></i>");
  const escaped = classes
    .join(" ")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return new HtmlInput(`<i class="${escaped}"></i>`);
}

test("the index matches registryStyles for generated registry texts", () => {
  const index = new RegistryIndex();
  for (const { css, classes } of generatedRegistries()) {
    const fragments = [
      fragment([]),
      ...classes.map((name) => fragment([name])),
      fragment(classes),
      fragment(["unrelated"]),
    ];
    for (const input of [...fragments, ...fragments.toReversed(), ...fragments])
      compareRegistry(index, css, input);
  }
});
