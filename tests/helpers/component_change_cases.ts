export type ComponentChangeCase = readonly [
  name: string,
  change: (source: string) => string,
  routes: readonly string[],
];

export const componentChangeCases: readonly ComponentChangeCase[] = [
  [
    "component-only implementation",
    (source) =>
      source.replace(
        "<button data-viewport=",
        '<button className="new-action" data-viewport=',
      ),
    ["components/action.html"],
  ],
  [
    "screen-owned invisible data",
    (source) =>
      source.replaceAll(
        'label="Hidden" hidden',
        'label="Invisible edit" hidden',
      ),
    ["screens/home.html"],
  ],
  [
    "screen-owned rendered slot",
    (source) => source.replaceAll("Screen content", "New screen content"),
    ["screens/home.html"],
  ],
  [
    "parent-owned child inputs",
    (source) => source.replace('label="Inside"', 'label="Updated inside"'),
    ["components/pane.html"],
  ],
  [
    "parent implementation",
    (source) =>
      source.replace(
        "<section>{props.children}",
        '<section className="new-pane">{props.children}',
      ),
    ["components/pane.html"],
  ],
  [
    "slot replay inside component",
    (source) =>
      source.replace(
        "<section>{props.children}",
        "<section>{props.children}<aside>{props.children}</aside>",
      ),
    ["components/pane.html"],
  ],
  [
    "screen-owned instance structure",
    (source) =>
      source.replaceAll(
        'moklyInstance="hidden"',
        'moklyInstance="other-hidden"',
      ),
    ["screens/home.html"],
  ],
  [
    "component and screen edits",
    (source) =>
      source
        .replace(
          "<button data-viewport=",
          '<button className="new-action" data-viewport=',
        )
        .replaceAll("Screen content", "Changed content"),
    ["components/action.html", "screens/home.html"],
  ],
  [
    "saved variant data",
    (source) =>
      source.replace(
        'props: { label: "Continue" }',
        'props: { label: "Next" }',
      ),
    ["components/action.html"],
  ],
  [
    "control schema metadata",
    (source) => source.replace("maxLength: 80", "maxLength: 100"),
    ["components/action.html"],
  ],
  ["no change", (source) => source, []],
];
