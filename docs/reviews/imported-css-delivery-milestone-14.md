# Imported CSS Delivery Milestone 14 Review

## Scope And Outcome

This review covers [Imported CSS Delivery](../../plans/imported-css-delivery.md)
Milestone 14. It ran on 2026-09-27 after `047bd03` was pushed, using
[the implementation review prompt](../implementation-review-prompt.md) against
`origin/main`. The complete branch diff was already reviewed twice; see the
[main review record](./imported-css-delivery.md), whose 15 open Milestone 12
findings are not repeated here. This review examined the changes since
`10433a4` in depth: `d474975`, which fixed Milestone 12 finding 1, and the
`047bd03` bookkeeping. It read them in the context of the whole CSS Modules
pipeline.

The fix is correct and complete for delivered CSS. Module `@import`s arrive in
order with correct pruning and inventory, custom-property `url()` assets are
copied, and the `image-set()` restorer did not corrupt output in any probe.
Class maps, composition, identity collisions and the class-map divergence
guard are unaffected. Mutation testing confirmed that the new tests fail when
dependency analysis is re-enabled or the restorer is removed. The example CSS
is byte-identical to the pre-fix build.

The three findings below were reproduced in a scratch copy. The parent
session independently confirmed finding 2's fallback deletion. They await the
user's decision, and the implementation has not changed in response to them.

## Findings

1. **Medium — CSS imported only by a compatibility transformer fails Build on
   a relative custom-property `url()`.**
   `src/build/styles/transformer_inventory.ts` still runs Lightning CSS
   `analyzeDependencies` to find the assets of transformer-only CSS. That mode
   throws "Ambiguous url(...) in custom property" for
   `--icon: url("./icon.svg")`. Following Lightning's advice to use an
   absolute URL then fails Mokly's root-absolute check, so no spelling of the
   URL builds. The same CSS imported from an entry builds. The bug has existed
   since `ff257b8`. `d474975` added protocol text saying this path "may still
   use dependency analysis", which accepts the problem. Impact: a consumer with
   a transformer that imports such CSS cannot build at all. Options: A) collect
   URLs with Mokly's own tolerant `extractCssReferences` and validate each
   local URL as Build does; B) keep Lightning but collect URLs through its
   visitor with dependency analysis off; C) document the restriction with a
   catalogued, Mokly-worded error. Recommended: A. Also correct the protocol
   sentence, and add a transformer-only column to the plain-vs-module
   equivalence table so the two URL collectors cannot drift apart again.
2. **Medium — CSS Modules run Lightning CSS with no browser targets, which
   deletes authored fallbacks and vendor prefixes.** Plain CSS is delivered as
   authored. Module CSS is re-printed by Lightning after PostCSS, so PostCSS
   cannot compensate. With no targets Lightning keeps only the last value of a
   fallback chain and drops prefixed duplicates. Examples:
   - `width: -webkit-fill-available; width: -moz-available; width: stretch`
     becomes `width: stretch`.
   - `-webkit-backdrop-filter` is dropped next to `backdrop-filter`.
   - `height: 100vh; height: 100dvh` becomes `height: 100dvh`.
   - `top/right/bottom/left: 0` becomes `inset: 0`.
   - `(min-width: 600px)` becomes `(width >= 600px)`.

   Unprefixed `width: stretch` works in no Firefox release, and unprefixed
   `backdrop-filter` needs Safari 18. So renaming `card.css` to
   `card.module.css` silently changes rendering in Firefox and older
   Safari/iOS. This contradicts the protocol's "preserving their meaning" and
   partly undoes the Styles guide's Safari 14 autoprefixer example. With a
   Safari 14 target, Lightning keeps every declaration. Neither Changes, which
   analyses CSS and HTML, nor the Chromium-only browser tests would notice.
   Options:
   - A) derive Lightning targets from the consumer's Browserslist
     configuration, loaded from the consumer repository, with a documented
     conservative default;
   - B) an opt-in Mokly setting for module targets;
   - C) keep no targets and document the behavior precisely, pinned by a test.

   Recommended: A, plus a test table asserting that fallback and prefix
   patterns survive under a Safari 14 target. C is the cheapest acceptable
   alternative.

3. **Low — the new tests would not catch lost import conditions or reordered
   imports.** The module import and equivalence tests only check that marker
   rules are present. Two mutations pass all 25 new tests while materially
   changing the stylesheet: stripping `supports()`/media conditions from
   module imports, so the imported rules apply unconditionally, and reversing
   module import order. Impact: a Lightning upgrade or ordering regression
   would ship silently. Options: A) compare whole stylesheets after one shared
   normalization (the same Lightning pass on both outputs, with scoped-name
   prefixes stripped, using the same targets as the module transform); B) add
   explicit assertions for the condition wrappers and the rule order; C) a
   byte snapshot of the module output. Recommended: A plus B's assertions, so
   failures are readable.
