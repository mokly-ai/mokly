/** Dimensions and route identities are shared by native and React fixtures. */
export interface LargeSize {
  areas: number;
  screens: number;
  rows: number;
  stylesheets: number;
  stylesheetShare: number;
}
export type Variant = "html" | "react";
export function largeSize(input: Partial<LargeSize> = {}): LargeSize {
  const size = {
    areas: 30,
    screens: 40,
    rows: 12,
    stylesheets: 4,
    stylesheetShare: 0.5,
    ...input,
  };
  for (const name of ["areas", "screens", "rows"] as const)
    if (!Number.isSafeInteger(size[name]) || size[name] <= 0)
      throw new Error(`${name} must be a positive integer`);
  if (size.screens < 2)
    throw new Error("screens must be at least two per area");
  if (!Number.isSafeInteger(size.stylesheets) || size.stylesheets < 0)
    throw new Error("stylesheets must be a non-negative integer");
  if (
    !Number.isFinite(size.stylesheetShare) ||
    size.stylesheetShare < 0 ||
    size.stylesheetShare > 1
  )
    throw new Error("stylesheetShare must be between 0 and 1");
  return size;
}
export function areaPaths(area: string, count: number) {
  const screens = Array.from(
    { length: count },
    (_, i) =>
      `${area}/screens/activity-group-${Math.floor(i / 10) + 1}/screen-${i + 1}`,
  );
  const flows = Array.from({ length: Math.ceil(count / 10) }, (_, i) => {
    const group = screens.slice(i * 10, i * 10 + 10);
    return group.length === 1 ? [...group, screens[0]!] : group;
  });
  return { screens, flows };
}
export function counts(size: LargeSize) {
  return {
    routes: size.areas * (size.screens + 10 + Math.ceil(size.screens / 10)),
    documents: size.areas * (size.screens * 4 + 35),
  };
}
export function stylesheetRules(size: LargeSize) {
  const shared = Array.from(
    { length: size.stylesheets },
    (_, i) => `assets/shared-${i + 1}.css`,
  );
  const linked = Math.ceil(size.screens * size.stylesheetShare);
  return [
    ...(shared.length && linked
      ? [
          {
            match: `area-*/screens/activity-group-*/screen-{${Array.from({ length: linked }, (_, i) => i + 1).join(",")}}/index*.html`,
            stylesheets: ["assets/catalogue.css", ...shared],
            darkStylesheets: ["assets/tokens-dark.css"],
          },
        ]
      : []),
    {
      match: "**/*.html",
      stylesheets: ["assets/catalogue.css"],
      darkStylesheets: ["assets/tokens-dark.css"],
    },
  ];
}
