export const cssReferenceInputs = [
  ["color: red; padding: 2px", []],
  ["color: var(--tone); transform: translateX(0px)", []],
  [String.raw`background: u\72l(icon.svg)`, ["icon.svg"]],
  [String.raw`@\69mport "theme.css";`, ["theme.css"]],
  ["a { background: url(a/*/b.svg); }", ["a/*/b.svg"]],
  ['a { background: url("a/*b.svg"); }', ["a/*b.svg"]],
  ['a { background: url("a/*comment*/b.svg"); }', ["a/*comment*/b.svg"]],
  ["a { background: /* asset */url(image.svg); }", ["image.svg"]],
  [
    '@import /* import */ "theme/*night*/tokens.css";',
    ["theme/*night*/tokens.css"],
  ],
  ['a { content: "url(fake.svg)"; background: url/**/("fake.svg"); }', []],
  [
    '@import url("theme.css"); a { background: URL(icon.svg); }',
    ["theme.css", "icon.svg"],
  ],
  ["a { background: url(icon.svg); } /* unclosed", ["icon.svg"]],
] as const;
