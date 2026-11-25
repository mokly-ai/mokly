# MiniJinja Templates In Mokly HTML

Status: Active. On branch `calummoore/mokly-html-templates-with-minijinja-41t4`, no pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says. Cal approved the plan on 2026-11-26. Decision 2 waits for the user. Only the TODOs marked "Waits for decision 2" wait for it.

Mokly HTML bodies (`.screen.html`, `.component.html`, `.page.html`) can only insert a prop with `{{name}}`, pass a prop to a component with `$name`, and keep or drop an element with `mokly-if="$name"`. The protocol says that an HTML component "cannot run code, loop, or compute". A real product catalogue needs lists, computed text such as plurals, and branches on enum states. A count of Conductive's React mockups, used only as a reference, found 106 files that map over lists, 305 inserts (264 plain value reads, 6 plurals, and about 14 function calls), and 144 enum schemas.

This change renders each HTML body as a MiniJinja template, as text, before the HTML parse. Four safeguards keep the checks of today: parser repairs fail the build, a token check over the template source checks every branch, exact source positions survive the render, and fuel limits loops. A parsed-tree cache lets the four documents of a view share one parse. Markdown documents, JavaScript components, and the sidecar do not change.

The work for this plan was brainstormed in the Conductive workspace on branch `calummoore/riga-oofj`. Cal manages it from this workspace. A separate workspace adds stylesheets to HTML components at the same time. Expect small conflicts in `crates/mokly-html`, and keep the two pull requests separate.

Contract owners:

- [HTML screens, pages, and use cases](../docs/protocol/mokly-html-screens.md) and [HTML components](../docs/protocol/mokly-html-components.md).
- A new protocol page, `docs/protocol/mokly-html-templates.md`, for the template language.
- [Component instance identity](../docs/protocol/mokly-instances.md), [rendering and document assembly](../docs/protocol/mokly-rendering.md), and the [runtime contract](../docs/protocol/mokly-runtime.md#render-graph-and-cache).
- The [Rust core architecture](../docs/architecture/rust-core.md), the [mokly-html README](../crates/mokly-html/README.md), the mokly-catalogue README, and the authoring guides under `docs/guides/authoring`.

Replaced ways:

- Tree substitution of `{{path}}` in text and attribute values (`props::substitute`, `props::substitute_raw`, `conditions::attributes`, `conditions::attribute_value`, `conditions::reserved`) → the MiniJinja render before the parse. Consumers: text nodes in `compose_machine.rs`, `elements.rs`, ignore wrappers, the `to`, `fragment`, and `mokly-instance` attributes in `components.rs`, saved variant slots in `slots.rs`, and the `mokly-html` tests. Moved and deleted in Milestone 4.
- Tree evaluation of `mokly-if="$path"` (`conditions::visible`) and the `$path` lookup in `components.rs` → lowered MiniJinja expressions with value handles, under option B of decision 2. Moved and deleted in Milestone 4.
- The discovery scan of `{{…}}` (`references::substitutions`, `references::use_reference`) in `mokly-catalogue/src/templates.rs` → the template analysis. Consumers: the template checker, the `html-unused-props` warning, and the identity fixtures under `crates/mokly-catalogue/tests/fixtures/identity`. Moved and deleted in Milestone 3.
- Positions from the parse of the authored body (`Template::located_html`) → positions from the parse of the rendered text, mapped back through the output spans of the render. Consumers: `source_locations::template`, error locations in `compose_machine.rs`, and the invocation site and `source` of each instance in `components.rs`. Moved in Milestone 4. Deleted in Milestone 5.
- The static `html-foster-parented` warning for authored bodies in `templates.rs` → the `html-repair` error. The warning of the composed re-parse in `normalization.rs` stays. Moved and deleted in Milestone 5.

## Decisions

### 1. How far MiniJinja goes in HTML bodies

Answered by Cal on 2026-11-25: **C**, full MiniJinja templates rendered as text before the HTML parse, with four safeguards: parser repairs fail the build, a token check over the blanked source, position markers, and fuel. The design below meets the position safeguard with output spans instead of markers, as my call. The alternative was **B**: MiniJinja expressions in `{{ … }}` and `mokly-if` plus a `mokly-for` attribute, on the parsed tree. B was a Mokly-only syntax. It could not build tag or attribute names from data, open and close a tag across branches, draw trees of any depth, or loop inside `<style>`, `<title>`, or `<textarea>`. C gives every feature of B and more, in a language that people and agents know, at about the same build time. Earlier calls of Cal: MiniJinja 3.1.0 (Apache-2.0, pure Rust) over Tera, Handlebars, Liquid, `upon`, `evalexpr`, CEL, Rhai, Boa, Starlark, QuickJS, and V8. The `stacker` feature stays off because it pulls in C.

### 2. How a component in a loop gets an object value

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-html-screens.md`, section "Component Elements", and `crates/mokly-html/src/components.rs:62-110`.
- **Terms:**
  - **Lowering:** the rewrite of a current form, such as `$name`, into a MiniJinja expression before compile.
  - **Value handle:** a private token that the render writes in place of a value. The tree pass swaps it back for the value.
- **Background:** A component element passes each attribute through its prop schema. A string, number, boolean, or enum prop takes the attribute text. An array or object prop needs `$name`, which today reads a prop of the parent unchanged. With decision 1, the body renders to text before the parse. So a loop variable, a `set` variable, or a macro argument no longer exists when the tree pass reads the attribute.
- **Problem:** A loop such as `{% for row in rows %}<ui-row row="$row"></ui-row>{% endfor %}` has no way to pass `row` as an object. A scalar can lose its value too: a `false` or `null` in a whole-value `{{ expr }}` removes the attribute, under the boolean rule of the design.
- **Impact if no action:** Authors cannot pass an array or object from a loop to a component. They must pass each field as a separate scalar attribute. The only list row in the repository, `examples/basic/src/components/workspace-member.component.html`, takes scalars, so the share of rows that take an object is not known.
- **Root question:** How does a value that exists only during the text render, such as a loop variable, a `set` variable, or a macro argument, reach the props of a component unchanged?
- **Options:**
  - **A.** JSON text: `row='{{ row | tojson }}'`, and an array or object prop accepts JSON text. The attribute needs single quotes, because `tojson` keeps `"` unescaped. It adds a second way next to `$name`, and values round-trip through text. `$row` in a loop still reads a prop named `row` when one exists, so it needs a shadowing error. Effort: Small.
  - **B.** `$path` reads any template variable: props, loop variables, `set` variables, and macro arguments. Lowering turns `row="$row"` into a call that keeps the value in a table for this render and writes a value handle. The tree pass swaps the handle for the unchanged value. `mokly-if="$row.done"` works the same way, and a value that is not a boolean fails with `html-props` at render. The table travels with the supplier context, so slot content that expands later still finds its values. The parse cache keeps handles, never values. It costs a Mokly-specific lowering and a handle table. Effort: Medium.
  - **C.** A `component` function: `{{ component("ui-row", row=row) }}` writes the element with value handles. It adds a second syntax for component calls, and slot content needs a `{% call %}` block. The token check over every branch cannot see the elements that it writes. It needs the shadowing error of A. Effort: Medium.
  - **D.** Private JSON in the text: `$path` reads any template variable, as in B. Lowering writes the value as escaped JSON behind a private prefix, and the tree pass decodes it. It needs no handle table, so slot content and the parse cache carry no state for each render. Each value is written, parsed, and decoded as text at each nesting level, so parse time grows with the size of the values. Effort: Medium.
  - **E.** Plain `{{ expr }}`: on a component element, an attribute whose whole value is one `{{ expr }}` passes an array or object result unchanged through the handle table of B. A scalar keeps the text, the coercion, and the boolean rule. `$name` reads only props. Any expression works, such as `rows | selectattr("done")`. The same `{{ }}` prints or passes by the type of the value at render, and a `false` or `null` still removes the attribute. It needs the shadowing error of A. Effort: Medium.
- **Left out:**
  - Scalars only fails the goal.
  - A loop attribute on the element, such as `mokly-for`, fails the goal. The text render runs before a tree loop binds the variable, so `{{ row.title }}` in its children cannot read it.
  - A prop path written at render, such as `$rows.3`, fails for `set` values, macro arguments, and filtered loops, which have no prop path.
  - Macros in place of row components fail the goal, because a macro has no instance region, no component page, and no Changes attribution.
- **Shared assumptions:**
  - Components stay HTML elements that the tree pass resolves. Source: "Component Elements" of the screens protocol. It holds, because slots, the sidecar, and instance regions need the tree.
  - Values reach the tree pass after the text render. Source: decision 1. It holds.
  - A passed value is JSON data, because props feed `props_key` and the sidecar wire format. Source: the code. It holds.
  - A loop of components sets `mokly-instance` from its data. Source: the instance contract. It holds.
- **Wider fix:** B, and D is as wide. The class is template values lost at the boundary between the text render and the tree. It has three readers: HTML component props, JavaScript component props, and `mokly-if`. B and D cover all three and every value shape.
- **Previous examples:** None found.
- **Recommendation:** B. One syntax, `$path`, passes every value unchanged, `false` and `null` included, with no text round trip. The options check of 2026-11-25 kept B.
- **Action:** Ask the user, because the recommended option adds behaviour at the component boundary that no requirement covers: `$path` that reads loop variables.

## Design

Each line is my call of 2026-11-25 unless it names Cal. The brief of Cal listed the calls marked "brief".

- **Crate.** A new MIT crate `mokly-template` owns the MiniJinja environment, the source analysis, the lowering, and the render. `mokly-catalogue` and `mokly-html` depend on it. Reason: one owner for the dependency and its pinned unstable API.
- **Features.** `minijinja = "=3.1.0"` with `builtins`, `serde`, `debug`, `fuel`, `macros`, `loop_controls`, `adjacent_loop_items`, and `unstable_machinery`. Off: `stacker` (Cal), `multi_template`, `json`, `speedups`, `std_collections`, `preserve_order`, `unicode`, and `urlencode`. `debug` gives error ranges and output spans. `unstable_machinery` gives the AST spans of the static checks. Reason: the exact pin covers the semver-exempt machinery API, and each feature that is off has no use here.
- **Compile once.** The prepared catalogue holds one environment with every body and saved slot compiled under its source identity. Compile takes about 0.002 ms for a 0.7 KB body.
- **Context.** The template context holds the props of the entry or the instance, and nothing else. Viewport and colour scheme stay out. Reason: one render then serves the four documents of a view, and `mokly-viewport` already selects content by viewport.
- **Undefined values (brief: strict mode).** The environment uses `SemiStrict`. Printing, iterating, or reading an attribute of an undefined value fails, and an `if` test treats it as false. A declared optional prop that is absent gets a Mokly absent value: it prints as the empty string, tests false, iterates as empty, and returns itself for an attribute read. So `{{a.b}}` with an absent `a` keeps printing nothing. Mokly replaces the `defined` and `undefined` tests and the `default` filter, so that they treat the absent value as undefined.
- **Static checks.** At discovery, every free name of every expression must be a declared prop or a Mokly global. A dotted path from a prop must match the prop schema, as today. Both fail with `html-props` in every branch and variant. Names come from `undeclared_variables(true)`, and spans come from the machinery AST. Paths from loop variables fail at render, under `SemiStrict`.
- **Escaping (brief).** Every template auto-escapes HTML. The `safe` filter is removed, and `{% autoescape %}` fails. A custom formatter prints numbers with Mokly's `number_text`, and prints `none` and the absent value as the empty string. Printing an array or a map fails with `html-props`, as today.
- **No input (brief).** The environment has no loader, so `include`, `import`, and `extends` fail. Macros inside one body stay. No global or filter reads files, the clock, random values, or the environment. Map iteration is key-sorted, so output is deterministic.
- **Plural (brief).** Mokly adds `plural`: `{{ n | plural("task", "tasks") }}` gives the first word when `n` is 1 and the second word otherwise. It has no locale rules.
- **Limits.** `set_fuel` bounds the instructions of one render. MiniJinja's recursion limit bounds nesting cost: without `stacker` it is at most 500, and each `if`, `for`, and macro call adds to it. Milestone 2 sets the fuel, keeps or lowers the limit, and tests the deepest render on a 2 MiB thread.
- **Current forms (brief).** Lowering keeps each current form exact. An attribute whose whole value is one `{{ expr }}` keeps the boolean rule: true gives an empty attribute, and false, `none`, or absent removes it. `mokly-if="$path"` keeps its boolean prop check for props. A prop name with a hyphen is readable only through `{{name}}`, `$name`, and `mokly-if`, because MiniJinja reads `-` as minus.
- **Syntax.** Text that opens template syntax and does not close, such as a lone `{{`, now fails. A character reference never forms template syntax. `{% raw %}` and `&#123;` write literal braces. Reason: decision 1 chose full templates, and no current catalogue body holds `{%`, `{#`, or a lone `{{`.
- **Diagnostics.** A template syntax, render, fuel, or forbidden-construct failure uses the new code `html-template`. A parser repair uses the new code `html-repair`. Reason: decision 1 adds these failures, and the existing codes name other problems.
- **Checks in three places.** Checks about presence run on the blanked source: elements, reserved names, slots, and `mokly-viewport` values. A blanked source replaces each `{{ }}`, `{% %}`, and `{# #}` with spaces of the same byte length. Prop reads, `mokly-if` types, and unused props come from the analysis of the lowered template, which knows loop and `set` scopes. Checks about the final text run on each distinct rendered text: duplicate attributes, page structure, parser repairs, and forbidden elements built from data. Reason: two branches can each hold one `class`, so a duplicate check over every branch at once is wrong.
- **Positions.** The render uses `Template::render_with_spans`, which maps each output range to the source range that wrote it. The parse of the rendered text records the output offset of each element, as the located parse does today, and the spans map it back to the source. Output of a macro maps to its call. A MiniJinja error maps back through the lowering offset table to its `{{` or `{%`. A parser repair names the source of its output line. Reason: spans give every position on every render with no extra markup, and markers before every tag cost 22–40% more parse time in the benchmark.
- **Parse cache.** A cache shared by documents and threads keeps each parsed tree and its output checks under the source identity and a digest of the rendered text and its spans. The spans are in the key, because two branches can write the same text from different source lines. It is bounded by bytes, evicts the least recently used tree first, and gives each use a clone. The runtime contract states the bound.
- **Saved slots.** A saved variant slot renders as a template with the props of its supplier, as substitution does today.
- **Loops of components.** A loop that repeats a component sets `mokly-instance` from its data, such as `mokly-instance="row-{{ row.id }}"`. The duplicate-id error stays, and its message names this fix. Reason: the instance contract forbids positional suffixes.
- **No mockup milestone.** No product screen or flow changes. The example entries of Milestone 7 exercise the engine, so they come after it.
- **New protocol page.** The template language gets its own page, because the screens page has 247 of its 250 lines.

Benchmark of 2026-11-25 in this workspace, three runs: today's check and parse take 3.9–6.3 ms for a 36 KB body and 28.9–30.3 ms for 142 KB. The MiniJinja render takes 0.008–0.037 ms. One check, four renders, one parse, and three clones are 53–73% faster than four checks and parses. Figures: `.context/minijinja-templates/bench-notes.md`.

## Milestone 1: Documentation and protocol

Depends on: none

Write the requirements and the decisions in force for the work below. Each changed page gets a status line that links the milestone that builds its missing behaviour.

- [x] Add `docs/protocol/mokly-html-templates.md`: the MiniJinja subset, the context, escaping, undefined values, the absent value, current forms, `plural`, limits, no input, determinism, the three check places, `html-template` and `html-repair`, and locations. Keep it under the 250-line cap, and split it if it grows.
- [x] Update `mokly-html-screens.md`: replace the template rules of "Screen Body" with a link to the new page, and update "Diagnostics" and the unused-props rule.
- [x] Update `mokly-html-components.md`: drop "cannot run code, loop, or compute" and "no computed values", and update "Body".
- [x] Update `mokly-instances.md` with the loop rule for instance ids, `mokly-rendering.md` with the render before the parse, and `mokly-runtime.md` with the parse-cache bound.
- [x] Update `docs/architecture/rust-core.md`: the new crate, the data flow, and the memory bounds.
- [ ] Waits for decision 2: state how a value that exists only during the render, such as a loop variable, reaches component props and `mokly-if`.

## Milestone 2: The `mokly-template` crate

Depends on: none. The design section of this plan specifies the crate, and no product code uses it in this milestone. My call of 2026-11-26, so that it runs beside Milestone 1.

Build the engine alone. No catalogue path uses it yet, so the product does not change.

- [x] Create the crate with its README, the MiniJinja pin, and the features of the design. Build it.
- [x] Configure the environment: `SemiStrict`, auto-escape, the formatter, no `safe`, no loader, fuel, the recursion limit, and `plural`.
- [x] Add the absent value and the conversion from `mokly_model::data::Props`.
- [x] Add the blanked source, the lowering of current forms, and the offset table.
- [ ] Waits for decision 2: lower `$path` for values that exist only during the render.
- [x] Add the static analysis: free names with spans, schema paths, and forbidden constructs.
- [x] Add the render API: rendered text and output spans mapped to source offsets.
- [ ] Waits for decision 2: carry render-only values to the tree pass.
- [x] Test each rule, including the fuel stop and the deepest render on a 2 MiB thread.
- [x] Run `npm run dependencies:check:rust`.

## Milestone 3: Discovery checks

Depends on: 1 and 2

Discovery compiles each body and saved slot and checks it before any render.

- [ ] Compile every body and saved slot into the environment of the prepared catalogue.
- [ ] Move the template checker of `mokly-catalogue/src/templates.rs` to the blanked source and the analysis. Delete `references::substitutions` and the parts of `use_reference` that only it uses.
- [ ] Derive `html-unused-props` from the analysis. Move the identity fixtures, with every assertion.
- [ ] Report `html-template` at discovery for syntax errors and forbidden constructs.

## Milestone 4: Render before the parse

Depends on: 3

Composition renders each body as text, then parses it. Every current test keeps passing.

- [ ] Render bodies, component bodies, pages, and saved slots before the parse, through the engine.
- [ ] Resolve value handles, `mokly-if` results, and removed attributes on the tree.
- [ ] Map element positions through the output spans, so that each component call site and each error names its source line and column.
- [ ] Delete tree substitution and tree `mokly-if` evaluation, as "Replaced ways" lists. Move their tests to the new path, with every assertion.
- [ ] Make the duplicate-id error of a component instance name the `mokly-instance` fix for loops.
- [ ] Add tests for loops, branches, computed text, tags across branches, loops in `<style>` and `<title>`, nested components in loops, and recursive macros.

## Milestone 5: Exact locations and output checks

Depends on: 4

- [ ] Map MiniJinja errors and output-check failures to source lines and columns.
- [ ] Run the output checks on each distinct rendered text.
- [ ] List the parser repairs that every body under `examples/`, `tests/`, and the crate fixtures causes today. Save the list under `.context/minijinja-templates/`. Report a benign repair kind as a finding before you continue.
- [ ] Fail each parser repair with `html-repair` from `html_sink.rs`. Delete the static `html-foster-parented` warning of authored bodies.
- [ ] Delete `Template::located_html` when nothing uses it.

## Milestone 6: Parse cache and timings

Depends on: 5

- [ ] Add the byte-bounded parse cache shared by documents and threads.
- [ ] Measure whole documents for a large templated screen before and after. Save the figures under `.context/minijinja-templates/`. Check the budgets of `docs/protocol/mokly-timings.md`.

## Milestone 7: Example entries and guides

Depends on: 6

- [ ] Add example entries under `examples/basic` for a list, a plural, an enum branch, and a component in a loop. Run the mockup check of `AGENTS.md`, and smoke-test the pages through `npm run dev`.
- [ ] Check `npm run format:check` on templated bodies. Prettier parses `*.component.html` as HTML.
- [ ] Update the guides under `docs/guides/authoring` and `docs/guides/start`, and the `mokly-html` and `mokly-catalogue` READMEs.
- [ ] Remove the status lines of Milestone 1.

## Milestone 8: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the `implementation-review` skill after the push. Report the findings, then apply the fix rule: fix the `fix now` findings, record follow-up items under `plans/follow-ups/` for the rest, re-review once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the plan".
- [ ] Open the pull request. Its description gives the decisions and the design calls of this plan with their dates, a permalink to this plan, and the follow-up items that the change adds.
