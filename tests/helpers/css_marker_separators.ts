import { markerEncoder } from "./css_marker_edits.js";

/** Mix raw joining opportunities, existing escapes and token-context traps. */
export function separatorMarkerCases(seed: number) {
  let state = seed;
  const random = (limit: number) => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state % limit;
  };
  const encoder = markerEncoder(seed ^ 0x7f123b);
  const separators = [
    " ",
    "\t",
    "\n",
    "\r",
    "\r\n",
    "\f",
    "/**/",
    '/* " */',
    "/*\nbody\n*/",
    "!",
    "-",
  ];
  const urlNames = [
    "#url",
    "@url",
    "\0url",
    String.raw`#\75rl`,
    String.raw`@\75rl`,
    String.raw`\0 url`,
  ];
  const seen = new Set<string>();
  const contexts = new Set<string>();
  const cases = [];
  for (let index = 0; index < 144; index++) {
    const parts = Array.from(
      { length: 1 + random(8) },
      () => separators[random(separators.length)]!,
    );
    const prefix =
      index % 4 === 0
        ? ["<! --", "<!/**/--", "< !--", "</**/!--"][(index / 4) % 4]!
        : "<" + parts.join("");
    const control = index % 6 === 5;
    const ending =
      index % 3 === 0
        ? `review-material:clock:${"a".repeat(64)}-->`
        : index % 3 === 1
          ? "component:start:r-1-->"
          : "review-ignore:start:clock-->";
    const raw = `${prefix}${control ? "ordinary" : "mokly"}-${ending}`;
    const marker =
      Math.floor(index / 6) % 2 ? raw : encoder.encode(raw, index, true);
    const reference = 'background:url("../asset.svg")';
    const kind = index % 6;
    let css: string;
    if (kind === 0) {
      contexts.add("declaration separators");
      css = `.entry{--x:(${marker});${reference}}`;
    } else if (kind === 1) {
      const supports = Math.floor(index / 6) % 2 === 0;
      contexts.add(supports ? "supports separators" : "at-rule separators");
      css = supports
        ? `@supports (${marker}){.entry{${reference}}}`
        : `@example (${marker});.entry{${reference}}`;
    } else if (kind === 2) {
      const url = urlNames[Math.floor(index / 6) % urlNames.length]!;
      contexts.add(url);
      const newline = ["\n", "\r", "\r\n", "\f"][random(4)]!;
      css = `.entry:foo(${url}(#x "${prefix}mok\\${newline}ly-${ending}")){${reference}}`;
    } else if (kind === 3) {
      contexts.add("outside continuation");
      const newline = ["\n", "\r", "\r\n", "\f"][random(4)]!;
      css = `.entry{--x:(${prefix}mok\\${newline}ly-${ending});${reference}}`;
    } else if (kind === 4) {
      contexts.add("selector string escapes");
      css = `.entry:is([title="${encoder.encode(raw, index, true)}"],main){${reference}}`;
    } else {
      contexts.add("utility control");
      css = String.raw`.md\:flex{display:flex}.w-1\/2{width:50%}.hover\:bg-red:hover{color:red}.entry{content:"\201C < ordinary";background:url("../asset.svg")}`;
    }
    if (!control && index % 4 !== 0) for (const part of parts) seen.add(part);
    cases.push({ index, kind, css, control });
  }
  return { cases, seen, contexts, separators, urlNames };
}
