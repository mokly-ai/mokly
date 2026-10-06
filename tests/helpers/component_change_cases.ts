export type ComponentChangeCase = readonly [
  name: string,
  change: (source: string) => string,
  ids: readonly string[],
];

export const componentChangeCases: readonly ComponentChangeCase[] = [
  [
    "component-only implementation",
    (source) =>
      source.replace(
        "<button data-viewport=",
        '<button className="new-action" data-viewport=',
      ),
    ["action"],
  ],
  [
    "screen-owned invisible data",
    (source) =>
      source.replaceAll(
        'label="Hidden" hidden',
        'label="Invisible edit" hidden',
      ),
    ["home"],
  ],
  [
    "screen-owned rendered slot",
    (source) => source.replaceAll("Screen content", "New screen content"),
    ["home"],
  ],
  [
    "parent-owned child inputs",
    (source) => source.replace('label="Inside"', 'label="Updated inside"'),
    ["pane"],
  ],
  [
    "parent implementation",
    (source) =>
      source.replace(
        "<section>{props.children}",
        '<section className="new-pane">{props.children}',
      ),
    ["pane"],
  ],
  [
    "slot replay inside component",
    (source) =>
      source.replace(
        "<section>{props.children}",
        "<section>{props.children}<aside>{props.children}</aside>",
      ),
    ["pane"],
  ],
  [
    "screen-owned instance structure",
    (source) =>
      source.replaceAll(
        'moklyInstance="hidden"',
        'moklyInstance="other-hidden"',
      ),
    ["home"],
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
    ["action", "home"],
  ],
  [
    "saved variant data",
    (source) =>
      source.replace(
        'props: { label: "Continue" }',
        'props: { label: "Next" }',
      ),
    ["action/default"],
  ],
  [
    "control schema metadata",
    (source) => source.replace("maxLength: 80", "maxLength: 100"),
    ["action"],
  ],
  ["no change", (source) => source, []],
];
