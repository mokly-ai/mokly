# Native Color Scheme (Dark Mode) Support

> **For agentic workers:** REQUIRED SUB-SKILL: use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make color scheme (`light`/`dark`) a first-class variant axis beside
the mobile/desktop viewport axis, per the approved spec at
[`docs/superpowers/specs/2026-08-06-native-color-scheme-design.md`](../docs/superpowers/specs/2026-08-06-native-color-scheme-design.md).

**Architecture:** A catalogue-wide `colorSchemes` config switch with per-screen
opt-out re-renders each screen's existing mobile/desktop nodes through the
consumer renderer with a new `colorScheme` input. Dark output is additive:
`<route>.<viewport>.dark.html` fragments, an optional `darkFragments` manifest
field (schema stays v3), a Browse top-bar Light/Dark switch that swaps
sandboxed iframe sources, and Review comparing viewport × scheme views with
`review.json` schemaVersion 2.

**Tech stack:** TypeScript ESM (Node 22 built-in test runner via `tsx --test`,
tests import from `../dist`), React 19 static rendering, parse5, Playwright
(Chromium against `examples/basic`), Rust `xtask` gate.

## Global Constraints

- Run `cargo xtask check` before declaring any milestone complete. It runs:
  `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run example:check`, `npm run package:check`, `npm run package:smoke`,
  `npm run test:browser`, `cargo fmt --all -- --check`, `cargo clippy
--workspace --all-targets -- -D warnings`, `cargo test --workspace`.
- After checks pass at each milestone end: `git add -A`, commit using
  Conventional Commits (title ≤ 50 chars), push the branch, then run
  `cargo xtask review`. Do NOT auto-fix review findings; report each finding
  with a recommendation in the final message.
- Tests import from `../dist/...`; always `npm run build` before running
  `tsx --test` directly. `npm test` already builds first.
- Never hand-edit `examples/basic/generated/**` HTML or the manifest; run
  `npm run example:build` and commit the regenerated output. The example's
  authored CSS files under `generated/` (`design.css`, `design-stage.css`,
  `design-review.css`, `example.css` if present) are consumer-authored public
  static files and ARE hand-edited.
- All new failures use `MoklyError` with existing code families
  (`config-invalid`, `build-invalid`, `manifest-invalid`, `review-invalid`).
  Registry violations use kebab `<verb>-<subject>` codes via `problem(...)`.
- No `serde`-style untyped blobs: new fields are typed on the existing
  interfaces. No inline `use`-equivalent churn: match each file's import
  grouping. Keep files near 300 lines; split modules that outgrow it.
- Protocol docs under `docs/protocol/` must be updated in the same milestone
  as the behavior they describe.
- The axis name is `colorScheme`/`colorSchemes` everywhere ("scheme" alone is
  already used for URL schemes). Canonical order is `["light", "dark"]`;
  union type order is alphabetical (`"dark" | "light"`) matching `Viewport`.

## Milestones

---

### Milestone 1: Scheme axis through config, build, manifest, and example

Backend only — no shell UI, no mockups. At completion: a dark-enabled config
builds/validates dark fragments end to end, `examples/basic` commits dark
output (design screens opt out), Browse/Review still serve light-only exactly
as today, and all existing tests plus new unit/integration tests pass.

#### Task 1.1: `ColorScheme` type, config validation, resolved config

**Files:**

- Modify: `src/authoring/types.ts`, `src/config/types.ts`,
  `src/config/rules.ts`, `src/config/validate.ts`, `src/index.ts`
- Test: `tests/config.test.ts`

**Interfaces produced:**

```ts
// src/authoring/types.ts
/** Light or dark color-scheme rendering target. */
export type ColorScheme = "dark" | "light";

// src/config/types.ts — MoklyConfig gains:
colorSchemes?: readonly ColorScheme[]; // default ["light"]
// ResolvedConfig gains (required, normalized light-first):
colorSchemes: readonly ColorScheme[];

// src/config/rules.ts
export function validateColorSchemes(value: unknown): ColorScheme[];
```

- [x] Write failing tests in `tests/config.test.ts`:

```ts
test("colorSchemes defaults to light and normalizes order", async () => {
  // resolveConfig without colorSchemes → resolved.colorSchemes = ["light"]
  // with ["dark", "light"] → normalized ["light", "dark"]
});
test("colorSchemes rejects invalid sets", async () => {
  // [] → "colorSchemes must be a non-empty array"
  // ["dark"] → 'colorSchemes must include "light"'
  // ["light", "light"] → "duplicate colorSchemes value: light"
  // ["light", "sepia"] → "colorSchemes contains an unknown value: sepia"
  // each throws MoklyError code "config-invalid"
});
```

Follow the file's existing pattern of building a config object and asserting
`assert.throws(() => resolveConfig(...), /message/)`.

- [x] Run `npm run build && npx tsx --test tests/config.test.ts` — new tests
      FAIL (unknown field is currently ignored).
- [x] Implement `validateColorSchemes` in `src/config/rules.ts` (accepts
      `undefined` → `["light"]`; validates array of `"light" | "dark"`, no
      duplicates, must include `"light"`; returns light-first). Call it in
      `resolveConfig` (`src/config/validate.ts`) and add `colorSchemes` to the
      returned literal. Add the field to both config types.
- [x] Export `ColorScheme` from `src/index.ts` (in the `authoring/types.js`
      type export block).
- [x] Run `npm run build && npx tsx --test tests/config.test.ts` — PASS.
- [x] Commit: `feat(config): add colorSchemes validation`

#### Task 1.2: Per-screen `colorSchemes` authoring + registry validation

**Files:**

- Modify: `src/authoring/types.ts` (`ScreenInput`, `NestedScreenInput`),
  `src/authoring/definitions.ts` (`flattenChild`),
  `src/registry/entry_validation.ts`
- Create: `src/registry/views.ts`
- Test: `tests/build.test.ts`, `tests/authoring.test.tsx`

**Interfaces produced:**

```ts
// ScreenInput and NestedScreenInput both gain:
colorSchemes?: readonly ColorScheme[];

// src/registry/views.ts (module doc comment required)
/** Ordered viewports shared by every generated screen. */
export const VIEWPORTS: readonly Viewport[] = ["mobile", "desktop"];
/** Resolve a screen's effective schemes against the catalogue default. */
export function effectiveColorSchemes(
  entry: { colorSchemes?: readonly ColorScheme[] },
  catalogueSchemes: readonly ColorScheme[],
): readonly ColorScheme[]; // entry.colorSchemes ?? catalogueSchemes
```

- [x] Write failing tests:
  - `tests/authoring.test.tsx`: nested `screen({ colorSchemes: ["light"] })`
    markers survive `defineRoot` flattening onto the `ScreenDefinition`
    (extend an existing defineRoot test's assertions).
  - `tests/build.test.ts`:

```ts
test("screen colorSchemes must be a subset of config", async (context) => {
  // fixture entry with colorSchemes: ["light", "dark"] under a light-only
  // config → compileCatalogue throws build-invalid mentioning
  // "unsupported-color-scheme"; colorSchemes: [] and ["dark"] and
  // ["light", "light"] each reported as "invalid-color-schemes"
});
```

- [x] Run `npm run build && npx tsx --test tests/build.test.ts tests/authoring.test.tsx` — FAIL.
- [x] Implement: spread `colorSchemes` through `flattenChild`'s `defineScreen`
      call (`...(node.colorSchemes ? { colorSchemes: node.colorSchemes } : {})`
      — mirror the `rationale` pattern; no inheritance, per spec non-goal). In
      `validateEntry` (screen branch) add checks:
  - shape (`invalid-color-schemes`): non-empty array, values in
    `{"light","dark"}`, no duplicates, includes `"light"` — message
    `colorSchemes must be a non-empty subset of ["light", "dark"] that includes "light"`;
  - subset (`unsupported-color-scheme`): every value present in
    `config.colorSchemes` — message
    `screen declares "dark" but config colorSchemes is light-only`.
- [x] Create `src/registry/views.ts` with the two exports above.
- [x] Run the tests — PASS. Run `npm run lint`.
- [x] Commit: `feat(authoring): per-screen colorSchemes opt-out`

#### Task 1.3: Fragment routes, rendering loop, renderer input

**Files:**

- Modify: `src/registry/manifest.ts` (`fragmentRoute`),
  `src/renderer/types.ts`, `src/build/render.ts`
- Test: `tests/build.test.ts`

**Interfaces produced:**

```ts
// src/registry/manifest.ts
export function fragmentRoute(
  route: string,
  viewport: Viewport,
  colorScheme: ColorScheme = "light",
): string; // dark: route.replace(/\.html$/, `.${viewport}.dark.html`)

// src/renderer/types.ts — RenderInput gains:
colorScheme: ColorScheme;
```

- [x] Write failing test in `tests/build.test.ts`:

```ts
test("dark schemes render dark fragments per view", async (context) => {
  // fixture with config colorSchemes ["light","dark"] (see Task 1.7 helper):
  // compileCatalogue outputs contain fixture.mobile.html, fixture.desktop.html,
  // fixture.mobile.dark.html, fixture.desktop.dark.html; a probe renderer is
  // not configurable here, so assert via the default renderer output equality
  // and route set; also assert a light-only screen produces exactly two routes
});
```

- [x] Run — FAIL (dark routes absent).
- [x] Implement: add the `colorScheme` parameter to `fragmentRoute`;
      in `renderFragments` replace the viewport loop body with a nested loop:

```ts
for (const viewport of VIEWPORTS) {
  for (const colorScheme of effectiveColorSchemes(entry, config.colorSchemes)) {
    const route = fragmentRoute(entry.route, viewport, colorScheme);
    ...
    rendered = renderer({ colorScheme, entry, node: entry[viewport], stylesheets, viewport });
```

Error messages include the view: `renderer failed for ${entry.id}
(${viewport}, ${colorScheme})` and `renderer must return a complete HTML
document for ${entry.id} (${viewport}, ${colorScheme})`.

- [x] Update the doc comments (`Mobile or desktop rendering target` style) and
      run `npm run build && npx tsx --test tests/build.test.ts` — PASS.
- [x] Commit: `feat(build): render dark fragments per view`

#### Task 1.4: Scheme-aware mock links and compatibility transform

**Files:**

- Modify: `src/build/mock_links.ts`, `src/build/render.ts` (call site),
  `src/compatibility/types.ts`, `src/compatibility/transform.ts`
- Test: `tests/build_links.test.ts`, `tests/compatibility.test.ts`

**Interfaces produced:**

```ts
export function rewriteMockLinks(
  html: string,
  sourceRoute: string,
  viewport: Viewport,
  colorScheme: ColorScheme,
  byId: ReadonlyMap<string, ResolvedRegistryEntry>,
  catalogueSchemes: readonly ColorScheme[],
): string;
export function artifactRouteForEntry(
  entry: ResolvedRegistryEntry,
  viewport: Viewport,
  colorScheme: ColorScheme,
  byId: ReadonlyMap<string, ResolvedRegistryEntry>,
  catalogueSchemes: readonly ColorScheme[],
): string | undefined;
export function logicalArtifactRoutes(
  entries: readonly ResolvedRegistryEntry[],
  viewport: Viewport,
  colorScheme: ColorScheme,
  catalogueSchemes: readonly ColorScheme[],
): Readonly<Record<string, string>>;
// CompatibilityTransformInput gains: colorScheme: ColorScheme;
// transform.ts: routeViewport(route) becomes
function routeView(route: string): {
  colorScheme: ColorScheme;
  viewport: Viewport;
};
```

- [x] Write failing tests:
  - `tests/build_links.test.ts`:

```ts
test("dark fragments link within dark and fall back to light-only", async () => {
  // screen A (light+dark) MockLinks to screen B (light+dark) and screen C
  // (colorSchemes ["light"]). In A's mobile dark fragment the B link targets
  // b.mobile.dark.html and the C link targets c.mobile.html.
});
```

- `tests/compatibility.test.ts`: extend an existing transformer test to
  assert the transformer receives `colorScheme: "dark"` for a dark output and
  that `logicalRoutes` maps to `.dark` artifacts for dark documents.

- [x] Run — FAIL.
- [x] Implement: `artifactRouteForEntry` resolves the target screen (screens
      directly; use-cases via first step) and falls back:
      `const scheme = effectiveColorSchemes(screen, catalogueSchemes).includes(colorScheme) ? colorScheme : "light";`
      then `fragmentRoute(screen.route, viewport, scheme)`. Fix the filename
      sniff in `transform.ts`: `routeView` matches, in order,
      `.mobile.dark.html` → mobile/dark, `.desktop.dark.html` → desktop/dark,
      `.mobile.html` → mobile/light, else desktop/light. Thread
      `colorScheme` into the transformer input.
- [x] Run — PASS.
- [x] Commit: `feat(build): scheme-aware links and compat input`

#### Task 1.5: Manifest `darkFragments` emission and validation

**Files:**

- Modify: `src/registry/types.ts`, `src/registry/manifest.ts`
  (`createManifest`, `toManifestEntry`), `src/registry/manifest_validation.ts`,
  `src/build/compile.ts` (fragment route enumeration + `createManifest` call)
- Test: `tests/manifest_files.test.ts`, `tests/build.test.ts`

**Interfaces produced:**

```ts
// ManifestScreen gains:
darkFragments?: Record<Viewport, string>;

// src/registry/manifest.ts
export function createManifest(
  entries: readonly ResolvedRegistryEntry[],
  legacyPages: readonly ManifestLegacyPage[],
  catalogueSchemes: readonly ColorScheme[],
): ManifestV3;
```

Update every existing `createManifest` call site (only `src/build/compile.ts`
in `src/`, plus any test callers) to pass the scheme list.

- [x] Write failing tests in `tests/manifest_files.test.ts`:

```ts
test("manifest validates darkFragments names and collisions", () => {
  // parseManifest accepts a screen with correct darkFragments
  // {mobile: "a.mobile.dark.html", desktop: "a.desktop.dark.html"};
  // rejects a wrong name ("has invalid or colliding mobile dark fragment"),
  // a colliding dark route, and a non-record darkFragments value
});
test("light-only manifests stay byte-identical", () => {
  // createManifest(entries, [], ["light"]) serializes without darkFragments
});
test("disabling dark orphans committed dark fragments", async (context) => {
  // build a dark-enabled fixture, then compile the same fixture with a
  // light-only config: pendingGeneratedOrphanRoutes / checkCompilation report
  // the committed *.dark.html files as proven orphans, and a build removes
  // them (assert via the existing orphan test pattern in tests/build.test.ts)
});
```

- [x] Run — FAIL.
- [x] Implement: `toManifestEntry` inserts (alphabetical key position, after
      `address`, before `fragments`):

```ts
...(effectiveColorSchemes(entry, catalogueSchemes).includes("dark")
  ? { darkFragments: {
      desktop: fragmentRoute(entry.route, "desktop", "dark"),
      mobile: fragmentRoute(entry.route, "mobile", "dark"),
    } }
  : {}),
```

In `manifest_validation.ts`: `validateScreen` validates the optional record
(both viewports, string, safe route); `validateFragmentRoutes` checks dark
names against `route.replace(/\.html$/, `.${viewport}.dark.html`)` and
registers them in `outputRoutes` for collision detection. In `compile.ts`
replace the two-element fragment array with
`effectiveColorSchemes(...)`-driven enumeration via `fragmentRoute`, and pass
`config.colorSchemes` to `createManifest`. `check.ts` needs no change (it
iterates `compilation.outputs`).

- [x] Run `npm run build && npx tsx --test tests/manifest_files.test.ts tests/build.test.ts` — PASS.
- [x] Commit: `feat(manifest): additive darkFragments field`

#### Task 1.6: Per-scheme stylesheet rules and watch classification

**Files:**

- Modify: `src/config/types.ts` (`StylesheetRule`), `src/config/rules.ts`
  (`validateStylesheets`), `src/build/render.ts` (`stylesheetsFor`),
  `src/server/watch_events.ts`
- Test: `tests/config.test.ts`, `tests/build.test.ts`,
  `tests/watch_config.test.ts`

**Interfaces produced:**

```ts
// StylesheetRule gains:
lightStylesheets?: readonly string[];
darkStylesheets?: readonly string[];
```

- [x] Write failing tests:
  - `tests/config.test.ts`: rules accept the two optional lists (validated
    like `stylesheets`: string entries, HTTP(S) pass-through, relative-route
    validation, `config-invalid` on bad entries).
  - `tests/build.test.ts`: a rule
    `{ match: "**/*.html", stylesheets: ["shared.css"], darkStylesheets: ["dark.css"] }`
    yields `shared.css` links in light fragments and `shared.css` + `dark.css`
    (that order) in dark fragments; a missing `dark.css` file fails
    `build-invalid` "stylesheet does not exist: dark.css".
  - `tests/watch_config.test.ts`: a change to a `darkStylesheets` file
    classifies as `reload`.
- [x] Run — FAIL.
- [x] Implement: extend `validateStylesheets` to validate/return the optional
      lists; give `stylesheetsFor` a `colorScheme` parameter appending the
      matching list after `stylesheets`; in `watch_events.ts` extract one
      helper that enumerates all configured sheet paths
      (`stylesheets`, `lightStylesheets`, `darkStylesheets`) and use it in the
      reload classification, `watchTargets`, and `isRequiredWatchPath` so all
      three stay aligned.
- [x] Run the three test files — PASS.
- [x] Commit: `feat(config): per-scheme stylesheet lists`

#### Task 1.7: Fixture helper option + changed-route attribution

**Files:**

- Modify: `tests/helpers/fixture.ts`, `src/server/changed.ts`
- Test: `tests/build_attribution.test.ts`

- [x] Extend `createFixture` with an options parameter,
      `createFixture(entrySource?: string, options?: { extraConfig?: string })`,
      appending `options.extraConfig` lines (e.g.
      `colorSchemes: ["light", "dark"],`) inside the generated
      `mokly.config.ts` object literal. Existing callers stay valid.
- [x] Write failing test in `tests/build_attribution.test.ts`:

```ts
test("dark fragment changes attribute their screen", async (context) => {
  // call changedManifestRoutes(manifest, baseManifest, config, changedPaths)
  // with identical base/head entries and changedPaths containing only
  // `<mockupsPrefix>/<route>.mobile.dark.html`; assert the screen route is
  // marked changed (and an unrelated screen is not)
});
```

- [x] Run — FAIL.
- [x] Implement in `changedPathCandidates` (`src/server/changed.ts`):

```ts
if (candidate.darkFragments) {
  candidates.push(
    `${mockupsPrefix}/${candidate.darkFragments.mobile}`,
    `${mockupsPrefix}/${candidate.darkFragments.desktop}`,
  );
}
```

(`isDeepStrictEqual` already covers the metadata diff.)

- [x] Run — PASS.
- [x] Commit: `feat(serve): attribute dark fragment changes`

#### Task 1.8: Example adoption (dark theme, opt-outs, regeneration)

**Files:**

- Modify: `examples/basic/mokly.config.ts`, `examples/basic/theme.ts`,
  `examples/basic/renderer.tsx`,
  `examples/basic/entries/design/browse_screens.tsx`,
  `examples/basic/entries/design/review_outcome_screens.tsx`,
  `examples/basic/entries/design/review_impact_screens.tsx`,
  `examples/basic/generated/**` (via `npm run example:build`),
  `examples/basic/README.md`
- Test: `npm run example:check`, packed-consumer suites via `npm test`

- [x] Add `colorSchemes: ["light", "dark"]` to the example config.
- [x] Add a `darkTokens` export to `theme.ts`: copy the existing token object
      and override the surface/text families with the dark palette
      (background `#121514`, raised surface `#1b201d`, primary text `#eef1ef`,
      secondary text `#c2cac4`, muted `#9aa39d`, hairline `#2a312d`), keeping
      the existing accent family. Map onto whatever token keys `theme.ts`
      actually declares — do not invent new keys.
- [x] Update `renderer.tsx`: build both themes once
      (`const themes = { dark: createSharedUiTheme(darkTokens), light: createSharedUiTheme(tokens) }`),
      select `themes[input.colorScheme]`, and emit the scheme on the document:
      `<html lang="en" data-color-scheme="${input.colorScheme}">` plus
      `color-scheme:${input.colorScheme}` and a matching body background in
      the inline style block.
- [x] Add `colorSchemes: ["light"]` to all 13 design `screen({...})` calls
      (6 in `browse_screens.tsx`, 4 in `review_outcome_screens.tsx`, 3 in
      `review_impact_screens.tsx`) — the design catalogue depicts the
      light-only shell. The two `catalogue.mockup.tsx` screens stay
      catalogue-default and go dark.
- [x] Run `npm run build && npm run example:build`, inspect a generated
      `*.dark.html` fragment renders the dark palette, then
      `npm run example:check` — clean.
- [x] Open `examples/basic/generated/catalogue/welcome.mobile.dark.html` (and
      the desktop variant) directly from disk and visually smoke-test the dark
      render.
- [x] Update `examples/basic/README.md` (dark adoption + opt-out proof).
- [x] Run `npm test` — all pass (packed consumers exercise the new contract).
- [x] Commit: `feat(example): adopt dark color scheme`

#### Task 1.9: Protocol docs + milestone gate

**Files:**

- Modify: `docs/protocol/mokly-package.md`, `README.md` (config/authoring
  usage), `plans/native-color-scheme-support.md` (tick boxes)

- [x] Update `mokly-package.md`: config shape (`colorSchemes`,
      stylesheet rule lists), authoring (`colorSchemes` opt-out rule),
      rendering boundary (`RenderInput.colorScheme`,
      `CompatibilityTransformInput.colorScheme`), generated contract (dark
      fragment names, `darkFragments` in the normative v3 shape, orphan
      lifecycle when dark turns off).
- [x] Update the README "Use Mokly" + Configuration sections with the
      two-step consumer story.
- [x] Run `cargo xtask check` (full gate; ~15 min; use a 1800000 ms timeout).
- [x] `git add -A`, commit
      (`feat(build): complete color-scheme build axis` if anything remains,
      else amend nothing), push the branch.
- [x] Run `cargo xtask review`; record findings for the final report, do not
      auto-fix.

---

### Milestone 2: Design mockups and shell design contract

Tags: mockup

The three new shell surfaces (Browse scheme switch + dark device chrome,
light-only fallback label, Review compare scheme control) are designed as
approved mockup screens in the example's design catalogue before any shell
implementation. No `src/` changes in this milestone.

#### Task 2.1: Dark-scheme Browse design screens

**Files:**

- Modify: `examples/basic/entries/design/parts/shell.tsx` (scheme-switch
  depiction in `TopBar`), `examples/basic/entries/design/parts/stage.tsx`
  (dark `PhoneFrame`/`BrowserFrame` presentation props),
  `examples/basic/entries/design/browse_screens.tsx` (two new `screen({...})`
  markers), `examples/basic/entries/design/design.mockup.tsx` (tree),
  `examples/basic/generated/design.css`, `generated/design-stage.css`
- Generated: `examples/basic/generated/design/browse/states/dark-scheme.*`,
  `.../light-only.*` (via `npm run example:build`)

- [x] Add a `SchemeSwitch` depiction (segmented `Light | Dark` control) to the
      design `TopBar`, shown right of the search field, matching the existing
      `mbk-seg` visual language.
- [x] Extend the depiction `PhoneFrame` with a `dark` prop: screen surface
      `#121514`, status-band ink `#eef1ef`; extend `BrowserFrame` with a
      `dark` prop darkening only the viewport area. Record the two token
      values used as CSS custom properties in `design-stage.css`
      (`--mbk-dark-screen-bg: #121514; --mbk-dark-screen-ink: #eef1ef;`).
- [x] Add screen `design/browse/states/dark-scheme.html` ("Dark scheme
      selected"): the shell with Dark active in the top bar and both frames
      rendering a dark mini-screen. Mobile and desktop variants; nav path
      under Design → Browse → States; `colorSchemes: ["light"]` like its
      siblings; description/rationale carry the implementation notes (never
      inside the screen area).
- [x] Add screen `design/browse/states/light-only.html` ("Light-only screen
      under dark"): Dark active, frames render the light mini-screen, frame
      labels read `MOBILE — LIGHT ONLY` / `DESKTOP — LIGHT ONLY`.
- [x] `npm run example:build && npm run example:check`; open both generated
      pages (all four fragments) directly from disk and visually smoke-test.
- [x] Commit: `feat(mockup): dark-scheme Browse design screens`

#### Task 2.2: Review compare scheme-control design screen

**Files:**

- Modify: `examples/basic/entries/design/parts/compare.tsx` (scheme segment
  beside the viewport segment), `review_outcome_screens.tsx` (one new
  screen), `design.mockup.tsx`, `examples/basic/generated/design-review.css`
- Generated: `examples/basic/generated/design/review/outcomes/dark-scheme.*`

- [x] Add screen `design/review/outcomes/dark-scheme.html` ("Dark view
      compare"): a compare page whose head band shows two `mbk-seg` groups —
      `Mobile | Desktop` and `Light | Dark` (Dark active) — over a
      side-by-side dark pane pair, with the changed classification badge.
      `colorSchemes: ["light"]`.
- [x] `npm run example:build && npm run example:check`; smoke-test from disk.
- [x] Commit: `feat(mockup): review scheme-control design screen`

#### Task 2.3: Shell design contract update + gate

**Files:**

- Modify: `docs/protocol/mokly-shell-design.md`

- [x] Extend the mockup table with the three new routes. Document: the
      top-bar scheme control (placement, `mbk-seg`, appears only when the
      catalogue has dark fragments), the dark device-chrome tokens
      (`--mbk-dark-screen-bg: #121514`, `--mbk-dark-screen-ink: #eef1ef`,
      applied to `.phone-screen`, `.phone-status`, `.browser-viewport` only —
      bezels, browser bar, traffic lights, address stay light), the
      `— LIGHT ONLY` frame-label state, and the compare-page scheme segment.
      State explicitly that the shell chrome outside device screens remains
      light-only (`color-scheme: light`).
- [x] Document the Task 2.1 mockup decisions in the contract: below the
      breakpoint the scheme control moves from the top bar into the screen
      head band (the 390px top bar cannot fit it); dark device screens also
      dim the phone home pill and depicted screen content surfaces; and the
      dark phone screen carries a 1px inset hairline
      (`color-mix(in srgb, var(--mbk-dark-screen-ink) 12%, var(--mbk-dark-screen-bg))`)
      so the screen edge stays visible against the bezel and notch.
- [x] Update the details-inspector state mockup
      (`design/browse/states/details.html` and its depiction part) to show
      the Schemes metadata row that Task 4.1 implements, so the row has an
      approved mockup before UI work begins.
- [x] Run `cargo xtask check` (full gate).
- [x] `git add -A`, commit (`docs(design): record color-scheme shell design`),
      push, run `cargo xtask review`; record findings.

---

### Milestone 3: Review engine views and review.json v2

Backend: the comparison model becomes viewport × scheme. Artifact pages keep
rendering (mechanical adaptation to the new model — page per view, existing
viewport segment intact); the _designed_ scheme control lands in Milestone 4.

#### Task 3.1: View model, comparison, aggregation

**Files:**

- Modify: `src/review/types.ts`, `src/review/compare.ts`,
  `src/review/base_manifest.ts` (no change expected — verify), `src/review/run.ts`
  (types only)
- Test: `tests/review.test.ts`, `tests/review_regressions.test.ts`

**Interfaces produced:**

```ts
// src/review/types.ts (replaces ViewportReview usage everywhere)
/** One view comparison and its retained artifact paths. */
export interface ViewReview {
  afterPath?: string;
  beforePath?: string;
  colorScheme: ColorScheme;
  ignoredIds: readonly string[];
  state: ReviewState;
  viewport: Viewport;
}
export interface ScreenReview {
  /* unchanged fields */ views: readonly ViewReview[];
}
export interface ReviewResult {
  /* unchanged fields */
  ignoredImpact: readonly {
    colorScheme: ColorScheme;
    count: number;
    id: string;
    viewport: Viewport;
  }[];
  schemaVersion: 2;
  screens: readonly ScreenReview[];
}
```

- [x] Write failing tests in `tests/review.test.ts`:

```ts
test("dark views compare and classify against a pre-dark base", async () => {
  // head has dark fragments, base manifest has no darkFragments:
  // screen.views contains mobile/desktop light (unchanged|changed as set up)
  // plus mobile/desktop dark with state "added"; review.json parses with
  // schemaVersion 2 and views entries carrying colorScheme
});
test("removing dark classifies dark views removed", async () => {
  // base has darkFragments, head is light-only → dark views state "removed"
});
```

Update every hand-built `ReviewResult`/`ScreenReview` literal across
`tests/review*.test.ts` (`viewports:` → `views:` with
`colorScheme: "light"`, `schemaVersion: 2`).

- [x] Run `npm run build && npx tsx --test tests/review.test.ts` — FAIL.
- [x] Implement in `compare.ts`: derive each side's scheme list from the
      manifest entry (`["light", ...(screen.darkFragments ? ["dark"] : [])]`),
      loop `for (const viewport of VIEWPORTS) for (const colorScheme of union)`,
      resolve the side's fragment
      (`colorScheme === "light" ? side.fragments[viewport] : side.darkFragments?.[viewport]`),
      and treat a side without that fragment as a missing pane (added/removed
      states). Rename `compareViewport` → `compareView` returning `ViewReview`.
      Update `aggregateIgnored` to key on
      `` `${viewport}:${colorScheme}:${id}` `` and split into three parts
      (`const [viewport, colorScheme, ...idParts] = key.split(":")`).
      Deterministic order: route, then viewport (mobile, desktop), then scheme
      (light, dark).
- [x] Run review tests — PASS.
- [x] Commit: `feat(review): compare viewport-scheme views`

#### Task 3.2: Artifact pages per view (mechanical) + page paths

**Files:**

- Modify: `src/review/paths.ts`, `src/review/artifact.ts`,
  `src/review/artifact_pages.tsx`, `src/review/artifact_navigation.tsx`
- Test: `tests/review_artifact_ui.test.ts`, `tests/review_safety.test.ts`

**Interfaces produced:**

```ts
export function comparisonPagePath(
  route: string,
  viewport: Viewport,
  colorScheme: ColorScheme,
): string;
// light: comparisons/<sha256(route)>/<viewport>/index.html   (unchanged)
// dark:  comparisons/<sha256(route)>/<viewport>.dark/index.html
```

Depth stays 3, so the hardcoded `rootPrefix: "../../../"` in
`artifact_pages.tsx` and `artifact_navigation.tsx` remains correct — do not
touch it.

- [x] Write failing test in `tests/review_artifact_ui.test.ts`:

```ts
test("artifact emits one compare page per view", () => {
  // a ReviewResult with light+dark views yields four comparison pages with
  // .dark directory segments for dark views and titles naming the scheme
});
```

- [x] Run — FAIL.
- [x] Implement: `artifact.ts` loops `screen.views`; page titles/labels append
      the scheme for dark views (`Mobile · Dark`); the existing viewport
      segment links to the _same-scheme_ sibling viewport via the new
      `comparisonPagePath`; navigation payload rows and `IgnoredImpactCard`
      keys include `colorScheme` (`${impact.id}-${impact.viewport}-${impact.colorScheme}`);
      screen rows link to their first material view in deterministic order.
      Path-collision behavior (`addArtifactFile`) is untouched.
- [x] Run `npm run build && npx tsx --test tests/review_artifact_ui.test.ts tests/review_safety.test.ts tests/review_performance.test.ts` — PASS.
- [x] Commit: `feat(review): per-view compare pages`

#### Task 3.3: Runtime protocol doc + gate

- [x] Update `docs/protocol/mokly-runtime.md`: Review Comparison section
      (view enumeration, union semantics, `.dark` page segment), the
      normative `review.json` schema (replace the v1 block with v2 exactly as
      in the spec), Check section (new failure classes from Milestone 1),
      Required Coverage (per-view comparison).
- [x] Run `cargo xtask check`; commit (`feat(review): review.json schema v2`),
      push, `cargo xtask review`; record findings.

---

### Milestone 4: Browse and Review shell UI

Tags: ui

Implements the Milestone 2 mockups: the top-bar scheme switch, iframe source
swapping, dark device chrome, fallback labels, details rows, state
persistence, and the designed compare-page scheme control. No engine changes.

#### Task 4.1: Server-rendered scheme hooks (stage, top bar, details)

**Files:**

- Modify: `src/server/catalogue.ts` (`hasDarkFragments`),
  `src/server/shell/head.tsx` (`SchemeSwitch`),
  `src/server/shell/document.tsx` (top-bar placement),
  `src/server/shell/stages.tsx` (fragment data attributes, fallback note),
  `src/server/shell/details.tsx` (Generated + Schemes rows)
- Test: `tests/shell.test.ts`

- [x] Write failing tests in `tests/shell.test.ts`:

```ts
test("scheme switch renders only for catalogues with dark fragments", ...);
test("screen stage carries per-frame scheme fragment data", ...);
// frames render data-fragment-light/data-fragment-dark; a light-only screen
// omits data-fragment-dark, sets data-color-scheme-fallback on the wrap, and
// includes the mbk-frame-scheme-note "— LIGHT ONLY"; details panel lists dark
// fragment paths and a "Schemes" row "light, dark"
```

- [x] Run — FAIL.
- [x] Implement:
  - `Catalogue` gains `hasDarkFragments: boolean` (any screen entry with
    `darkFragments`).
  - `SchemeSwitch()` in `head.tsx`, mirroring `ViewportSwitch`:
    `<span aria-label="Color scheme" className="mbk-seg" data-mokly-schemeswitch="" role="group">`
    with buttons `data-color-scheme-option="light" | "dark"`, light
    `aria-pressed="true"` server-side. Render it in the `document.tsx` top
    bar (right of search, before the Browse/Review mode switch) when
    `catalogue.hasDarkFragments`.
  - Responsive placement follows the approved Task 2.1 mockup: top bar at
    and above the 56.25rem breakpoint; below it the control renders in the
    screen head band beneath the viewport control instead (the 390px top
    bar cannot fit it).
  - `stages.tsx`: every fragment iframe (screen frames and flow steps) gains
    `data-fragment-light={<light route>}` and, when present,
    `data-fragment-dark={<dark route>}`; the wrap of a dark-less screen gets
    `data-color-scheme-fallback=""`; frame labels gain
    `<span className="mbk-frame-scheme-note"> — LIGHT ONLY</span>`.
  - `details.tsx`: Generated row values include dark fragments; add a
    `Schemes` MetaRow (text `light, dark` / `light`) when
    `catalogue.hasDarkFragments`.
- [x] Run `npm run build && npx tsx --test tests/shell.test.ts` — PASS.
- [x] Commit: `feat(shell): server-rendered scheme hooks`

#### Task 4.2: Dark device-chrome CSS

**Files:**

- Modify: `src/server/shell/css_tokens.ts` (two tokens),
  `src/server/shell/css_chrome.ts` (dark blocks),
  `src/server/shell/css_views.ts` (note visibility)
- Test: `tests/shell.test.ts` (the `SHELL_CSS` design-contract test)

- [x] Extend the design-contract CSS assertions first (FAIL), then implement
      per the Milestone 2 contract:

```css
:root {
  --mbk-dark-screen-bg: #121514;
  --mbk-dark-screen-ink: #eef1ef;
}
body[data-mokly-color-scheme="dark"] .phone-screen {
  background: var(--mbk-dark-screen-bg);
  box-shadow: inset 0 0 0 1px
    color-mix(
      in srgb,
      var(--mbk-dark-screen-ink) 12%,
      var(--mbk-dark-screen-bg)
    );
}
body[data-mokly-color-scheme="dark"] .phone-status {
  color: var(--mbk-dark-screen-ink);
}
body[data-mokly-color-scheme="dark"] .browser-viewport {
  background: var(--mbk-dark-screen-bg);
}
.mbk-frame-scheme-note {
  display: none;
}
body[data-mokly-color-scheme="dark"]
  .mbk-frame-wrap[data-color-scheme-fallback]
  .mbk-frame-scheme-note {
  display: inline;
}
```

The shell `color-scheme: light` declaration and every other chrome token are
untouched.

- [x] Run shell tests — PASS. Commit: `feat(shell): dark device chrome`

#### Task 4.3: Client switching and state persistence

**Files:**

- Modify: `src/client/browse_state.ts`, `src/client/browse.ts`
- Test: `tests/client_browse.test.ts`, `tests/client.test.ts`

**Interfaces produced:**

```ts
// browse_state.ts
export type BrowseColorScheme = "dark" | "light";
// BrowseRecoveryState gains: colorScheme: BrowseColorScheme;
export function setColorScheme(doc: Document, value: BrowseColorScheme): void;
export function currentColorScheme(doc: Document): BrowseColorScheme;
```

- [x] Write failing tests in `tests/client_browse.test.ts`:

```ts
test("setColorScheme swaps fragment sources and marks the body", ...);
// body data-mokly-color-scheme set; iframes with data-fragment-dark get
// the dark src; fallback iframes keep light; switch buttons aria-pressed sync
test("recovery state restores color scheme strictly", ...);
// capture includes colorScheme; parse rejects an invalid value (whole
// snapshot dropped, matching the viewport precedent)
```

- [x] Run — FAIL.
- [x] Implement: `setColorScheme` sets `body` `data-mokly-color-scheme`,
      syncs `[data-color-scheme-option]` `aria-pressed`, and for every
      `iframe[data-fragment-light]` assigns
      `value === "dark" && data-fragment-dark ? data-fragment-dark : data-fragment-light`
      (resolving via the existing `/static/` prefix convention already baked
      into the attributes — store full `src` values in the attributes to keep
      the client dumb). `currentColorScheme` reads the body attribute with
      `"light"` fallback. In `browse.ts`: add the delegation branch before
      the viewport branch; after a progressive route swap re-apply
      `setColorScheme(doc, currentColorScheme(doc))` so new iframes adopt the
      selection; extend `captureBrowseState`/`restoreBrowseState`/
      `parseBrowseRecoveryState` with the strict field.
- [x] Run `npm run build && npx tsx --test tests/client_browse.test.ts tests/client.test.ts` — PASS.
- [x] Commit: `feat(client): color scheme switching`

#### Task 4.4: Designed compare-page scheme control

**Files:**

- Modify: `src/review/artifact_pages.tsx` (scheme segment per mockup)
- Test: `tests/review_artifact_ui.test.ts`

- [x] Write failing test: compare pages for a screen with dark views render
      two `mbk-seg` groups — viewport (`Mobile | Desktop`, same-scheme links)
      and color scheme (`Light | Dark`, same-viewport links,
      `aria-label="Color scheme"`); a light-only screen renders no scheme
      segment; the active option uses `aria-current="page"`.
- [x] Run — FAIL. Implement per the Milestone 2 mockup (labels `Light`/
      `Dark`; sibling links via `comparisonPagePath(route, viewport, scheme)`
      and `relativeLink`). Drop the Task 3.2 interim `Mobile · Dark` title
      suffix in favor of the two-segment design (keep the scheme in the
      `<title>` text).
- [x] Run — PASS. Commit: `feat(review): compare-page scheme control`

#### Task 4.5: Browser tests + runtime doc + gate

**Files:**

- Modify: `tests/browser/browse.spec.ts`, `tests/browser/review.spec.ts`,
  `docs/protocol/mokly-runtime.md` (Browse Shell + watched development
  state list)

- [x] Browser-verify the dark phone screen's 1px inset hairline is actually
      visible against the bezel with a dark fragment loaded (the fragment
      surface must not occlude it), and that scheme swaps do not flash a
      white fragment surface (found during Task 4.2 review).

- [x] Add Playwright tests (they run against the dark-enabled
      `examples/basic`):

```ts
test("color scheme switch swaps device frames", ...);
// open the catalogue welcome screen, click Dark, expect both iframe srcs to
// end in .dark.html, body attribute set; open a design (light-only) screen,
// expect light srcs plus the visible "LIGHT ONLY" note; click Light restores
test("scheme selection survives progressive navigation", ...);
// select Dark, navigate to the second screen via the nav column, expect the
// new stage iframes to load .dark.html without re-clicking
```

Extend the existing watched-reload state restoration test in
`tests/browser/watch.spec.ts` to assert the scheme survives a reload (or add
one matching its pattern).

- [x] Run `npm run test:browser` — PASS.
- [x] Update `mokly-runtime.md` Browse Shell section (scheme switch,
      fallback label, details rows) and the watched-reload restored-state
      list (add color scheme).
- [x] Run `cargo xtask check`; commit with title
      `feat(shell): browse dark mode switching`; push; run
      `cargo xtask review`; record findings.

---

### Milestone 5: Preview snapshot, docs polish, final verification

Closes the loop: static preview deployment covers dark, top-level docs match,
plan is filed complete.

#### Task 5.1: Preview snapshot coverage

**Files:**

- Inspect/modify: `scripts/preview/build.mjs`

- [x] Read the snapshot's route enumeration. If it derives fetched routes
      from manifest fragment fields, extend it with `darkFragments`; if it
      crawls served documents, verify `data-fragment-dark` URLs are captured.
      Add/adjust so `.dark.html` fragments land in the artifact.
- [x] Run `npm run preview:build`; verify `.context/mokly-preview`
      contains dark fragments and the scheme switch works when serving the
      artifact directory statically (e.g.
      `npx --no-install wrangler pages dev .context/mokly-preview` or any
      static file server; from-disk `file://` is not required for the
      snapshot).
- [x] Commit: `fix(preview): snapshot dark fragments` (or note no change was
      needed in the plan file).

#### Task 5.2: Docs consistency pass + final gate

- [x] Tune `examples/basic/theme.ts` `darkTokens` with a dark-mode accent
      override so link text meets WCAG AA (the inherited light sage
      `#4f7864` is 3.63:1 on `#121514`), then regenerate the example, and
      retune the design catalogue's dark depiction link tone
      (`design-stage.css`) to match (found during Task 2.1/2.2 reviews).
- [x] Widen the eslint ignore for generated review output from root-only
      `.context/**` to `**/.context/**` in `eslint.config.js`, so nested
      fixture review artifacts cannot fail `npm run lint` (found during
      Task 4.5).
- [x] Re-read the spec end to end and verify each requirement has landed;
      re-read `README.md`, `docs/protocol/mokly-package.md`,
      `mokly-runtime.md`, `mokly-shell-design.md`,
      `examples/basic/README.md`, `examples/basic/notes.md` for consistency
      (no conflicting statements; consumer story reads: config + renderer +
      build).
- [x] Move this plan to Completed in `plans/README.md`; tick all boxes.
- [x] Run `cargo xtask check` (full gate).
- [x] `git add -A`, commit (`docs: finish color-scheme documentation`), push.
- [x] Run `cargo xtask review`; report all findings from every milestone with
      numbered items, severities, context, impact, lettered options, and
      recommendations — without auto-fixing.
