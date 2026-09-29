# Imported Stylesheet CSS Modules

Continuation of [Imported Stylesheet Delivery](./mokly-imported-styles.md).
The [error catalogue](./mokly-imported-styles-errors.md) gives exact messages.

## CSS Modules And Import Loaders

For `*.module.css`, Mokly runs its own PostCSS parser and the same rename-only
CSS Modules pipeline as css-loader and Vite's default: first
`postcss-modules-local-by-default({ mode: "local" })`, then
`postcss-modules-extract-imports()`, then
`postcss-modules-scope({ generateScopedName })`, followed by
`icss-utils.extractICSS(root)`. Load these packages lazily in the main process;
the isolated worker is only for consumer PostCSS plugins. Run after renderer
pruning and consumer PostCSS, sharing the `(source, effective pruned set)`
memo between the graph and stylesheet passes. The generated name is
`mokly_<hash>_<local>` where `<hash>` is the first **12 lowercase hex** digits
of SHA-256 over the UTF-8 repository-relative POSIX stylesheet path. It never
depends on source bytes, bundle order, process cwd or platform separators.
Distinct local identities colliding at a generated name fail Build.

CSS whitespace in selectors and `@scope` preludes means only space, tab, line
feed, carriage return and form feed. A hex escape consumes its next single
whitespace character (CRLF as one character), even after six hex digits, so
that character is not a combinator or a comma-boundary space. Unicode spaces
such as U+00A0 are name characters. One shared forward scan classifies CSS
whitespace, strings, escapes and comments; comments end at the first `*/`.

`@scope` prelude localization is Mokly-owned until the CSS Modules plugins
fix their text splitting. Parse `[trivia] [(start)] [trivia] [to [trivia]
(limit)] [trivia]`; trivia is whitespace or comments, `to` is a standalone
top-level identifier (case-insensitive), and either group may be absent.
Groups are balanced through nested parentheses/brackets, quoted strings,
escapes and comments. A missing/empty group, dangling `to`, extra text or
third group fails with the catalogued prelude error at the at-rule's authored
line/column. Empty params mean no prelude. Preserve every character outside
the group interiors, including keyword case and comments. Hide all at-rules
whose names end in `scope` from the plugins; only a real `@scope` (any case)
gets temporary selector rules for its start/limit. The rules sit just before
the at-rule in its parent and carry its source location; after plugin scoping,
read their localized selectors, remove them and restore the original at-rule
name and params. Other scope-suffixed at-rules retain their params unchanged.
The prelude uses normal selector localization, including default local,
`:global(...)`, `:local(...)`, bare modes, lists, `:scope`, `&`, `:is()` and
`:not()`. Local prelude names are exported and count for identity collisions.
In selectors, including `@scope` groups and nested pseudos, the plugins keep
non-empty items inside `:global(...)`/`:local(...)` in order and drop empty
items. A comma is a descendant join only when the **authored** text has
whitespace on either side, in an empty item, or beside a comment. Use selector
source offsets to distinguish authored spaces from parser-moved spaces. `.x, .y`,
`.x ,.y` and `.x,\n.y` become `.x .y`, while `.x,.y` becomes `.x.y` on one
element. Comments alone are not whitespace. Whitespace just inside the
wrapper is dropped; a compound before or after it attaches to the first or
last item. Whitespace anywhere after the first comma following the last
non-empty wrapper item, including empty items and whitespace beside comments,
moves out of `:global()` or `:local()`. Whitespace before that first tail
comma is dropped, and comments alone move nothing. Moved whitespace separates
the next selector: `.w:global(.x, ):hover` becomes
`.w.x :hover`, and `.w:global(.a, ):global(.x)` becomes `.w.a .x`.
Inside another pseudo-class, a kept comment after the wrapper absorbs moved
whitespace there; without kept content, it propagates to the next outer
selector. At top level, a comment after the wrapper does not stop the
separation. Find comment boundaries forward from `/*`, not backward from
`*/`, so an inner `/*` within a comment has no effect.
The same move out of `:is()`, `:where()`, `:not()`, `:has()`,
`:nth-child(… of …)`, `:host()`, `::slotted()` or another pseudo never counts
as authored outer whitespace. `.card:is(.a, ).b` would change to a descendant
and fails Build; removing the trailing comma fixes it. The rule also applies
inside wrappers, nested rules and `@scope` groups.

A `:global()` or `:local()` with no non-empty selector fails Build **before**
the plugins run, wherever it occurs, including a nested pseudo, nested rule
or either `@scope` group. Empty means no text, whitespace, comments, empty
comma items, or any combination. The error names the actual wrapper and the
authored rule or `@scope` line/column. A wrapper with at least one selector
may still contain empty items, which disappear. Newly created joins
or attachments that fuse names (`div,span` → `divspan`, `.x,div` → `.xdiv`,
or `.w:global(div)` → `.wdiv`) fail. So does a type or universal selector
newly placed after another simple selector (`[a],div` → `[a]div`). Identical
authored compounds outside wrappers are not judged. Other invalid output the
plugins produce is not rejected by this narrow check. For example,
`.w :global(::before,.x)` reaches bundling with plugin output `::before.x`;
esbuild may reprint the final selector. This is css-loader/Vite module-scoping
behavior, not selector-list expansion.
The temporary selector rules also make those names available as earlier
selectors for a later `composes`, including when the scope is nested in a
rule, `@media`, `@supports` or `@layer`.

Before the CSS Modules plugins run, scan raw authored rule selectors,
including nested rules, and raw `@scope` preludes. Fail Build at the authored
rule or at-rule location if a hex escape ends with a tab, line feed, carriage
return, CRLF or form feed; if a six-digit escape is followed by any CSS
whitespace; or if an escape is followed immediately by a comment immediately
followed by CSS whitespace. Skip strings and comments themselves. A one-to-five
digit escape ended by one space, or an escape ended by a non-whitespace
character, remains supported. The [catalogued error](./mokly-imported-styles-errors.md)
gives the edit to make. This guard uses raw selector/parameter text because
PostCSS can remove a comment before the plugins see it.

After restoration, verify the scoping result against its input with parsed
PostCSS trees. Remove only input `composes`/`compose-with` declarations
(case-insensitive), then compare node counts, types and order. Standalone comments,
declaration properties/importance and all unrelated at-rule params are exact.
Value tokens may remain identical or change one valid identifier word to
`mokly_<hash>_<word>`; `global(word)`/`local(word)` may collapse to that word
or its scoped version. Strings, functions, dividers and whitespace-token
presence otherwise stay unchanged. Selector trees may unwrap `:global` and
`:local` (including bare forms and their dropped combinator), and may join
non-empty wrapped items by the plugin rule above. Selector comment nodes are
ignored on both sides, including a selector comment hoisted just before its
rule; unrelated standalone comments stay exact. Comma joins use authored
source offsets, not whitespace the selector parser moved out of unrelated
pseudos. Every meaningful combinator remains. Only class, ID and `[class=…]`
values may gain the exact module prefix. A keyframes-family
at-rule param may likewise gain that prefix after optional local/global
unwrapping. Scope params keep the same group structure and non-group bytes;
their interiors follow the selector rule. Equal selector/value text skips
tokenization; parse failure counts as a difference. Report the first
difference with the input node's file/line/column. This check does not infer
semantic animation correctness: `animation-name: ease` still passes when the
plugin leaves that local keyframe reference bare. The plugin's invalid
`animation: grow-progress auto linear` rewrite and quoted-keyframe prefix
rewrite fail Build rather than shipping invalid CSS.
The browser regression uses only selectors Chrome parses. Accepted rows must
have the same parsed meaning. A same-meaning rejection is allowed only for the
documented strict case of whitespace moved out of a non-wrapper pseudo-class
by a trailing comma; this preserves the pre-existing fail-closed rule.

Only local classes, IDs, `@keyframes` names and their `animation` and
`animation-name` references are renamed. `:global(...)` stays global and
`:local(...)` becomes a local selector. `@counter-style` names and list-style
references, `view-transition-name`, custom properties and `var(--token)`,
grid-area and container names remain global. The scoper does not optimize,
prefix, polyfill or normalize other declarations, selectors, comments,
`@import`s, `url()`s, `image-set()` options, fallbacks, media/supports/layer
conditions or modern CSS syntax. These reach esbuild as authored; plain and
module bundles differ only in the scoped names. The authored quoted-local
`image-set()` guard still runs before scoping. Lightning CSS remains a
read-only parser for Changes and transformer-only inventory, never a module
delivery transformer. Browserslist targets are the consumer's PostCSS concern,
not a Mokly CSS Modules input.

Before the plugins run, reject authored `:import(...)`, `:export` and
`@value` with the exact catalogued diagnostics. Lightning previously left
authored ICSS rules in CSS without binding them to JavaScript, and rejected
`@value`; explicit failure avoids silent changes. After the plugins, reject
generated ICSS imports as cross-file `composes` with the existing message.
Same-file `composes` may reference only a class defined **earlier** in that
file; a forward or missing name fails with the catalogued location. This is
the css-loader/Vite rule and makes local cycles impossible. `from global`
works. The default export is a plain map of sorted local keys to the plugins'
space-joined values: owning scoped name first, then composed names in authored
order, including repeats. Each valid, non-reserved JavaScript identifier is
also a named string export with the same value. Other keys remain on the
default map. Plain CSS imports supply no JavaScript class map.
If PostCSS and renderer pruning produce a different export map between the
graph and delivered stylesheet passes, fail before writing instead of emitting
class names with no matching rules.

`moduleResolution.loaders` reserves `.css` and `.module.css`: their only
allowed consumer value is `empty`. `.css: "empty"` opts out of **both**
plain and module CSS, `.module.css: "empty"` opts out only of modules;
set both only if desired for clarity. An opted-out module supplies an empty
default map and no named bindings or delivered CSS; its file remains in
`sourceFiles` as a graph input. Other CSS loaders fail config validation.
No extension may use the consumer `css` loader: it would produce an
undelivered sibling file. Rename a stylesheet to `.css` or choose a
JavaScript-safe loader for non-stylesheet imports.
Any other consumer `file` loader used by a JavaScript import fails Build:
Mokly never exposes the extra JavaScript graph outputs as public URLs.
