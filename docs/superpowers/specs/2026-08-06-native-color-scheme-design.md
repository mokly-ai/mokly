# Native Color Scheme (Dark Mode) Design

- Date: 2026-08-06
- Status: Implemented (plans/native-color-scheme-support.md, all milestones)
- Scope: Mokabook package (authoring, config, build/check, Browse, Review,
  shell design, example)

This is a historical design record. The current generated-output lifecycle and
manifest schema are defined by [generated output](../../protocol/mokly-generated-output.md).

## Goal

Make color scheme a first-class variant axis in Mokabook, alongside the
mobile/desktop viewport axis. A consumer adopts dark mode with one config
change and one renderer change — no per-screen authoring, no duplicated
entries, and no consumer-side stage-prop or theme-context glue.

The axis is named `colorScheme` (type `ColorScheme = "light" | "dark"`), not
`scheme`, because this codebase already uses "scheme" for URL schemes in link
and resource validation.

## Consumer Integration Story

1. Set `colorSchemes: ["light", "dark"]` in `mokabook.config.ts`.
2. Read `input.colorScheme` in the configured renderer and apply the matching
   theme (for example a dark `SharedUiTheme`), typically also setting
   `color-scheme` and a `data-*` hook on the emitted document.
3. Run `mokabook build`.

Every screen then generates dark fragments, Browse offers a Light/Dark
switch, and Review compares both schemes. A screen whose design is
intentionally light-only opts out with `colorSchemes: ["light"]` in its
definition. A light-only consumer changes nothing and gets byte-identical
output.

## Decisions And Rationale

1. **Derived rendering, not authored dark trees.** A screen keeps one mobile
   node and one desktop node; dark is produced by re-rendering the same node
   with `colorScheme: "dark"` passed to the consumer renderer. Why: theming is
   the consumer renderer's job today (that is where `@firna/ui` theme
   providers live), doubling authored nodes would double authoring cost for
   near-zero benefit, and this is the only shape that makes whole-catalogue
   dark coverage free.
2. **Config-wide opt-in plus per-screen opt-out.** `colorSchemes` in config
   turns the axis on for the catalogue; `colorSchemes: ["light"]` on a screen
   keeps that screen light-only. Why: the common path needs zero per-screen
   work, but a screen whose design deliberately has no dark variant (print or
   invoice previews) must not show a wrong dark render in Browse/Review.
   Per-screen declarations must be a non-empty, duplicate-free subset of the
   config set and must include `"light"`.
3. **Closed two-value axis.** `ColorScheme` is exactly `"light" | "dark"`.
   Arbitrary named schemes (high contrast, sepia) are out of scope. Why: the
   shell toggle, device chrome, and CSS `color-scheme` semantics are
   light/dark specific; a general variant system is speculative.
4. **Light stays canonical and unsuffixed.** Light fragments keep their
   current names (`<route>.mobile.html`, `<route>.desktop.html`); dark adds
   `<route>.mobile.dark.html` and `<route>.desktop.dark.html`. Why: enabling
   dark is purely additive — no renames, no diff churn for existing
   catalogues. Under the current output contract, disabling dark removes those
   fragments on build; tracked `check` reports them as extra files.
5. **Manifest schema v3 with one additive optional field**, not a v4
   restructure. Screen entries gain `darkFragments?: { mobile; desktop }`,
   present exactly when the screen's effective schemes include dark. Why:
   committed base manifests (and the legacy v2 compatibility path) keep parsing
   with no third version branch in Review base reading; light-only manifests
   stay byte-identical. Internally, code normalizes entries into a uniform
   view list (viewport × scheme) at the read boundary so downstream logic
   never special-cases dark.
6. **`review.json` bumps to schemaVersion 2.** The per-viewport array becomes
   `views`, each entry carrying `viewport` and `colorScheme`; `ignoredImpact`
   entries gain `colorScheme`. Why: silently emitting duplicate viewport
   entries under schema 1 would break any reader that assumes one entry per
   viewport; the file is regenerated per run and has no committed consumers,
   so an honest bump is cheap.
7. **Browse gets one global Light/Dark control; the shell chrome stays
   light.** The control lives in the top bar, appears only when the manifest
   contains any dark fragment, and swaps every embedded fragment (screen
   frames and use-case flow steps). The Browse/Review shell itself remains
   light-only per the shell design contract. Why: the goal is dark product
   screens, not a dark tool; a neutral light frame around a dark canvas is
   standard design-tool presentation; a full dark shell is a separate design
   effort with contrast and token work that should not gate this feature.
8. **Device chrome becomes scheme-aware only inside the device screen.** The
   phone status band (clock, signal, Wi-Fi, battery) and the phone screen
   surface flip to light-on-dark so dark mobile screens do not carry a white
   band; the browser frame's viewport surface darkens behind the desktop
   fragment. Bezels, the browser bar, traffic lights, and the address pill
   stay light because they represent device/browser UI outside the page.
9. **Light default, no `prefers-color-scheme` auto-selection.** Browse starts
   light; the selection persists across watched reloads exactly like viewport
   selection. Why: deterministic screenshots and reviews, consistency with
   the light shell, one-click switch anyway.
10. **Stylesheet rules gain per-scheme appended lists.** A rule keeps its
    shared `stylesheets` and may add `lightStylesheets` / `darkStylesheets`
    appended for the matching scheme's fragments. Why: consumers commonly ship
    scheme token CSS as separate files; append semantics keep ordering
    deterministic and the shared list untouched.
11. **Links stay inside their scheme, falling back to light.** A `mock:` link
    in a dark fragment resolves to the target's dark fragment when it exists,
    otherwise its light fragment. Same-viewport resolution is unchanged.
12. **Review treats views uniformly.** Comparison enumerates viewport × scheme
    from the union of base and head manifests: a dark view present only in
    head classifies `added`, only in base `removed`. No dark special-casing.

## Authoring And Config Contract

```ts
type ColorScheme = "light" | "dark";

interface MokabookConfig {
  // existing fields unchanged
  colorSchemes?: readonly ColorScheme[]; // default ["light"]
  stylesheets?: readonly {
    match: string;
    stylesheets: readonly string[];
    lightStylesheets?: readonly string[];
    darkStylesheets?: readonly string[];
  }[];
}

interface ScreenInput {
  // existing fields unchanged
  colorSchemes?: readonly ColorScheme[]; // default: config colorSchemes
}
```

- Config `colorSchemes` must be non-empty, duplicate-free, and include
  `"light"`; it normalizes to light-first order. Allowed sets are `["light"]`
  and `["light", "dark"]`.
- `defineScreen` and the nested `screen()` marker accept `colorSchemes`.
  Definition-time validation checks values, emptiness, and duplicates;
  registry validation checks the subset-of-config rule and reports a screen
  that declares dark while the config is light-only. No nested-tree
  inheritance of `colorSchemes` in this design.
- A screen's effective schemes are `entry.colorSchemes ?? config.colorSchemes`.
- `ColorScheme` is exported from the package root.

## Rendering Contract

`RenderInput` gains one required field:

```ts
interface RenderInput {
  entry: ScreenDefinition;
  node: ReactNode;
  stylesheets: readonly string[];
  viewport: Viewport;
  colorScheme: ColorScheme;
}
```

- The builder renders each screen once per effective view (viewport ×
  scheme). Light-only catalogues always pass `"light"`, so existing renderers
  keep working unchanged.
- `stylesheets` is the resolved list for that view: the rule's shared list
  plus its matching per-scheme list, in declaration order.
- `CompatibilityTransformInput` gains the same `colorScheme` field, and its
  `logicalRoutes` map targets the current viewport and scheme with the
  light fallback for dark-lacking targets.

## Generated Contract

- Dark fragment routes derive as `<route>.{viewport}.dark.html`. Route
  collision, safe-route, and authored-root checks cover the enlarged set.
- Manifest schema stays version 3. Screen entries gain:

```ts
interface ManifestScreenAdditions {
  darkFragments?: { mobile: string; desktop: string };
}
```

- `darkFragments` is present exactly when the screen's effective schemes
  include dark, and omitted otherwise (never `null`). Validation checks the
  routes like `fragments`. Version 2 compatibility input never produces it.
- Dark fragments participate in whole-tree transactional writes and tracked
  missing/stale/extra detection. Turning dark off removes them on build; tracked
  `check` reports old fragments as extra files.

## Browse Shell

- Top bar: a Light/Dark segmented control (aria-label "Color scheme"),
  rendered only when the manifest has any `darkFragments`. Selection applies
  to screen stages and use-case flow steps by swapping each sandboxed
  iframe's `src` between fragment routes carried on frame data attributes, so
  it works served, in the static preview snapshot, and after watched reloads.
- A light-only screen under dark selection shows its light fragment and its
  frame label reads `MOBILE — LIGHT ONLY` / `DESKTOP — LIGHT ONLY`.
- Server-rendered documents default to light; the hydrated shell applies the
  persisted selection after its matching first render. Without JavaScript,
  Browse shows light fragments.
- Watched-reload state recovery and history restoration persist the scheme
  selection alongside viewport selection in the existing Browse state.
- The details inspector's Generated row lists dark fragment paths, and a
  Schemes row shows the screen's effective schemes when dark is enabled.
- Changed attribution includes `darkFragments` in route-level manifest
  comparison, so a dark-only visual change marks the screen changed.

## Review

- Views enumerate viewport × scheme from the union of base and head
  manifests; pairing is route + viewport + scheme. States per view:
  added/removed/changed/ignored-only/unchanged; screen aggregate rules are
  unchanged. Old bases without `darkFragments` mean head-only dark views
  classify `added`.
- The artifact emits one compare page per view. Compare pages add a scheme
  segmented control beside the viewport control, linking sibling views that
  exist on either side. Side-by-side, overlay, and difference modes are
  unchanged per page.
- Review-ignore boundaries and material keys stay per generated document;
  aggregation keys become id + viewport + scheme.
- Git base extraction batches the doubled path set through the existing
  bounded `ls-tree` / `cat-file` machinery.
- `review.json` becomes schemaVersion 2:

```ts
interface ReviewResultV2 {
  schemaVersion: 2;
  baseRef: string;
  baseCommit: string;
  changedPaths: readonly string[];
  sharedImpact: readonly string[];
  ignoredImpact: readonly {
    id: string;
    viewport: "mobile" | "desktop";
    colorScheme: "light" | "dark";
    count: number;
  }[];
  screens: readonly {
    id: string;
    route: string;
    title: string;
    state: ReviewState;
    dependencies: readonly string[];
    sharedImpact: readonly string[];
    views: readonly {
      viewport: "mobile" | "desktop";
      colorScheme: "light" | "dark";
      state: ReviewState;
      beforePath?: string;
      afterPath?: string;
      ignoredIds: readonly string[];
    }[];
  }[];
}
```

- Deterministic order: route, then viewport (mobile, desktop), then scheme
  (light, dark).

## Check And Validation

`mokabook check` extends its existing failure classes over dark fragments
(stale/missing/extra tracked output, link and resource resolution, anchors,
collisions) and adds:

- invalid config `colorSchemes` (empty, duplicates, unknown value, missing
  `"light"`);
- a screen `colorSchemes` violating local rules or the subset-of-config rule;
- missing or duplicate `lightStylesheets` / `darkStylesheets` files;
- manifest `darkFragments` inconsistency (present without effective dark,
  absent with it, or invalid routes).

Watch classification is unchanged: dark fragments are header-proven generated
output, and per-scheme stylesheet files join the configured-stylesheet reload
precedence.

Legacy pages and authored static HTML have no scheme axis; legacy discovery,
rendering, and lints are untouched.

## Shell Design Contract And Mockups

Per repository rules, mockups land before UI implementation:

- `docs/protocol/mokly-shell-design.md` gains the color-scheme control,
  the dark device-chrome tokens (phone screen surface, status-band ink,
  browser viewport surface), and the `LIGHT ONLY` frame-label state. The
  shell tokens themselves stay light-only.
- The design catalogue in `examples/basic/entries/design/` adds approved
  screens (mobile and desktop variants each): a Browse screen view with dark
  selected (`design/browse/states/dark-scheme.html`) and a Review compare
  page with the scheme control (`design/review/outcomes/dark-scheme.html`).

## Example, Tests, And Docs

- `examples/basic`: enable `colorSchemes: ["light", "dark"]`, add dark tokens
  and scheme handling to the renderer adapter, keep one light-only screen to
  prove the opt-out, and commit the regenerated output. Packed-consumer
  checks then exercise the contract end to end.
- Unit: config/registry validation, fragment route derivation, manifest
  emission and validation, link rewriting with light fallback, stylesheet
  resolution per scheme.
- Integration: build/check/review over dark-enabled fixtures, orphan
  lifecycle when dark turns off, review against a pre-dark base.
- Browser (Playwright): toggle swaps frames and flow steps, persistence
  across watched reload, light-only fallback label, compare-page scheme
  control, no-JavaScript light default.
- Docs: README, `mokly-package.md`, `mokly-runtime.md`,
  `mokly-shell-design.md`, and the example README/notes updated with the
  new contract.

## Non-Goals

- A dark Browse/Review shell chrome (revisit after adoption).
- Additional or arbitrary schemes beyond light/dark.
- Dark-only screens or catalogues (`"light"` is mandatory).
- Nested-tree inheritance or per-collection scheme defaults.
- URL-addressed scheme deep links and `prefers-color-scheme` auto-selection.
- Scheme support for legacy pages.
- A Both mode showing light and dark side by side.

## Compatibility Summary

- Light-only consumers: byte-identical generated output, no config or
  renderer changes, no manifest or fragment renames.
- `RenderInput.colorScheme` is additive; existing renderer modules type-check
  and behave unchanged.
- Review against bases without `darkFragments` works through the additive
  manifest field; `review.json` readers update for schemaVersion 2 (none are
  committed today).
