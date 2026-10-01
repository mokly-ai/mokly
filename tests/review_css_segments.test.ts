import assert from "node:assert/strict";
import test from "node:test";

import { scanCssSegments } from "../src/review/css/segments.js";

for (const [name, source, keys] of [
  ["empty", "", []],
  ["trivia", " \t\n/* comment */ <!-- --> ", []],
  [
    "exact keys",
    " /*before*/.a{}/*between*/ \n .b { color: red } /*after*/",
    [".a{}", ".b { color: red }"],
  ],
  [
    "inner trivia",
    ".a/*middle*/ { /*declaration*/color:red; }",
    [".a/*middle*/ { /*declaration*/color:red; }"],
  ],
  [
    "statements and blocks",
    "@layer a; @layer b{} @media screen{.a{} .b{}}",
    ["@layer a;", "@layer b{}", "@media screen{.a{} .b{}}"],
  ],
  [
    "nested typed brackets",
    ".a:is([data-v='}'],.b){&:is(.c){color:red}}",
    [".a:is([data-v='}'],.b){&:is(.c){color:red}}"],
  ],
  [
    "quoted braces",
    String.raw`.a{content:'{\'}';--value:"}\"{"}`,
    [String.raw`.a{content:'{\'}';--value:"}\"{"}`],
  ],
  [
    "escaped identifiers",
    String.raw`.\7b a{--value:\};color:red}`,
    [String.raw`.\7b a{--value:\};color:red}`],
  ],
  [
    "opaque URL",
    String.raw`.a{background:url(a{[/*x*/\)z)} .b{}`,
    [String.raw`.a{background:url(a{[/*x*/\)z)}`, ".b{}"],
  ],
  [
    "escaped URL name",
    String.raw`.a{background:u\72 l(a{b})}`,
    [String.raw`.a{background:u\72 l(a{b})}`],
  ],
  [
    "quoted URL",
    '.a{background:url( "a{b}" )}',
    ['.a{background:url( "a{b}" )}'],
  ],
  ["CDO CDC", "<!-- .a{} --> .b{} <!-- .c{} -->", [".a{}", ".b{}", ".c{}"]],
  ["midrule CDO", ".a<!-- {}", [".a<!-- {}"]],
  [
    "normalization",
    "\uFEFF.a{\r\ncolor:red\r}\f.b{}",
    [".a{\ncolor:red\n}", ".b{}"],
  ],
  ["single BOM", "\uFEFF\uFEFF.a{}", ["\uFEFF.a{}"]],
] as const) {
  test(`segment scanner: ${name}`, () => {
    const scan = scanCssSegments(source);
    assert.ok(scan.status === "segmented");
    assert.deepEqual(
      scan.segments.map(({ start, end }) => scan.source.slice(start, end)),
      keys,
    );
    assert.ok(
      scan.segments.every(
        ({ start, end }, index) =>
          end > start && start >= (scan.segments[index - 1]?.end ?? 0),
      ),
    );
  });
}

for (const source of [
  "/* unclosed",
  ".a{/*unclosed",
  '.a{content:"}',
  ".a{content:'}",
  ".a{content:foo\\",
  ".a{content:'foo\\",
  ".a{background:url(a{b)",
  ".a{background:url(a{b}",
  ".a{background:url(a\\",
  ".a{",
  ".a([)]{}",
  ".a{color:red]}",
  ".a{} }",
  ")",
  "]",
  ".a",
  ".a{} trailing",
  "@layer a",
  "<!--a{color:red}",
  "<!---->",
  "<!--body{color:red}-->",
  "b{color:blue}<!--a{color:red}",
  "<!--_",
  "<!--9",
  "<!--\\",
  "<!--你",
  ".a<!--a{}",
]) {
  test(`segment scanner discards every partial range on anomaly: ${source}`, () => {
    assert.deepEqual(scanCssSegments(source), { status: "anomaly" });
  });
}

test("an unexpected scanner input never escapes", () => {
  assert.deepEqual(scanCssSegments(null as unknown as string), {
    status: "anomaly",
  });
});
