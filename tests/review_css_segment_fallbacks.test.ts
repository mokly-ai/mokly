import assert from "node:assert/strict";
import test from "node:test";

import type { Rule, Selector, StyleSheet } from "lightningcss";

import { transform } from "../src/review/css/lightning.js";
import { CssResourceAnalysis } from "../src/review/css/resource_analysis.js";
import { LightningCssRuleParser } from "../src/review/css/rules.js";
import type { CssRuleParser } from "../src/review/css/types.js";

import { parseSnapshot } from "./helpers/css_segments.js";

function fallbackParser(native: CssRuleParser) {
  const whole: string[] = [];
  const batches: (readonly string[])[] = [];
  const analysis = new CssResourceAnalysis({
    parse(source) {
      whole.push(source);
      return native.parse(source);
    },
    ...(native.parseSegments
      ? {
          parseSegments(segments: readonly string[]) {
            batches.push([...segments]);
            return native.parseSegments!(segments);
          },
        }
      : {}),
  });
  return { parser: analysis.parser, whole, batches };
}

for (const source of [".a{", "/*unclosed", "<!--a{}", ".a([)]{}", "trailing"])
  test(`scanner fallback uses the original element and whole failure cache: ${source}`, () => {
    const original = `\uFEFF \r\n${source}`;
    const observed = fallbackParser(new LightningCssRuleParser());
    const first = observed.parser.parseInline!(original);
    assert.deepEqual(
      parseSnapshot(first),
      parseSnapshot(new LightningCssRuleParser().parse(original)),
    );
    assert.equal(observed.parser.parseInline!(original), first);
    assert.deepEqual(observed.whole, [original]);
    assert.deepEqual(observed.batches, []);
  });

for (const source of [
  '@charset "UTF-8";.a{}',
  '@IMPORT "theme.css";.a{}',
  '@namespace svg "urn:svg";svg|a{}',
  String.raw`@\69mport "theme.css";.a{}`,
  String.raw`@\6e amespace "urn:svg";.a{}`,
])
  test(`contextual decoded at-rule falls back without a batch: ${source}`, () => {
    const observed = fallbackParser(new LightningCssRuleParser());
    assert.deepEqual(
      parseSnapshot(observed.parser.parseInline!(source)),
      parseSnapshot(new LightningCssRuleParser().parse(source)),
    );
    assert.deepEqual(observed.whole, [source]);
    assert.deepEqual(observed.batches, []);
  });

test("an injected parser without native verification uses the complete element", () => {
  const native = new LightningCssRuleParser();
  const observed = fallbackParser({ parse: (source) => native.parse(source) });
  observed.parser.parseInline!(".a{} .b{}");
  assert.deepEqual(observed.whole, [".a{} .b{}"]);
  assert.deepEqual(observed.batches, []);
});

for (const failure of ["undefined", "wrong-run-count", "throws"])
  test(`invalid batch ${failure} falls back and retains no partial runs`, () => {
    const native = new LightningCssRuleParser();
    const observed = fallbackParser({
      parse: (source) => native.parse(source),
      parseSegments(segments) {
        if (failure === "throws") throw new Error("injected batch failure");
        return failure === "undefined"
          ? undefined
          : native.parseSegments(segments)!.slice(0, 1);
      },
    });
    const source = ".a{} .b{}";
    observed.parser.parseInline!(source);
    observed.parser.parseInline!(source);
    assert.deepEqual(observed.batches, [
      [".a{}", ".b{}"],
      [".a{}", ".b{}"],
    ]);
    assert.deepEqual(observed.whole, [source]);
  });

type Mutation = (sheet: StyleSheet) => void;
const located = (rule: Rule) => {
  assert.ok("value" in rule && rule.value);
  return rule.value;
};
const styled = (rule: Rule) => {
  assert.ok(rule.type === "style");
  return rule.value;
};
const mutations: readonly [string, Mutation][] = [
  [
    "missing root",
    (sheet) => {
      sheet.rules.pop();
    },
  ],
  [
    "extra root",
    (sheet) => {
      sheet.rules.push(sheet.rules[0]!);
    },
  ],
  [
    "root start",
    (sheet) => {
      located(sheet.rules[0]!).loc.column++;
    },
  ],
  [
    "root source",
    (sheet) => {
      located(sheet.rules[0]!).loc.source_index = 1;
    },
  ],
  [
    "duplicate root",
    (sheet) => {
      sheet.rules[1] = sheet.rules[0]!;
    },
  ],
  [
    "unsupported root",
    (sheet) => {
      sheet.rules[0] = { type: "ignored" };
    },
  ],
  [
    "unsupported descendant",
    (sheet) => {
      styled(sheet.rules[0]!).rules = [{ type: "ignored" }];
    },
  ],
  [
    "descendant crossing segment",
    (sheet) => {
      located(styled(sheet.rules[0]!).rules![0]!).loc = located(
        sheet.rules[1]!,
      ).loc;
    },
  ],
  [
    "descendant before body",
    (sheet) => {
      located(styled(sheet.rules[0]!).rules![0]!).loc.column = 1;
    },
  ],
  [
    "serialization failure",
    (sheet) => {
      styled(sheet.rules[0]!).selectors = [
        [{ type: "not-a-native-selector" }],
      ] as unknown as Selector[];
    },
  ],
  [
    "sentinel location",
    (sheet) => {
      located(sheet.rules.at(-1)!).loc.column++;
    },
  ],
  [
    "sentinel source",
    (sheet) => {
      located(sheet.rules.at(-1)!).loc.source_index = 1;
    },
  ],
];

for (const [name, mutate] of mutations)
  test(`native ${name} uncertainty falls back for the entire element`, () => {
    const original =
      " /*outside*/ .a{color:red;.nested{color:blue}} .b{} /*outside*/";
    const batch =
      ".a{color:red;.nested{color:blue}}\n.b{}\n@mokly-segment-end;";
    const native = new LightningCssRuleParser((options) =>
      transform({
        ...options,
        visitor: {
          ...options.visitor,
          StyleSheet(sheet) {
            if (Buffer.from(options.code).toString("utf8") === batch)
              mutate(sheet);
            assert.ok(typeof options.visitor === "object");
            return options.visitor.StyleSheet?.(sheet);
          },
        },
      }),
    );
    const observed = fallbackParser(native);
    assert.deepEqual(
      parseSnapshot(observed.parser.parseInline!(original)),
      parseSnapshot(new LightningCssRuleParser().parse(original)),
    );
    assert.deepEqual(observed.whole, [original]);
    assert.deepEqual(observed.batches, [
      [".a{color:red;.nested{color:blue}}", ".b{}"],
    ]);
  });

test("native boundary verification rejects a root ending before its segment terminator", () => {
  assert.equal(
    new LightningCssRuleParser().parseSegments([".a{} /*outside*/"]),
    undefined,
  );
});

test("a native batch parse failure is not returned as an element error or cached as a run", () => {
  const observed = fallbackParser(new LightningCssRuleParser());
  const source = "/* outside */ .a{} .b{notvalid} /* outside */";
  const first = observed.parser.parseInline!(source);
  assert.deepEqual(
    parseSnapshot(first),
    parseSnapshot(new LightningCssRuleParser().parse(source)),
  );
  observed.parser.parseInline!(source);
  assert.equal(observed.batches.length, 2);
  observed.parser.parseInline!(".a{}");
  assert.deepEqual(observed.batches.at(-1), [".a{}"]);
});
