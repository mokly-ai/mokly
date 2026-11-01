# Diagnostics And HTML Messages

Status: Active. On branch
`conductor/rust-rebuild-87-diagnostics-and-html-messages`, no pull request
yet. The plan closes when its PR merges. Items 128, 1, and 6 wait for Cal,
so Milestone 4 moves to follow-up items. This branch completes the other
milestones and deletes the plan before its pull request merges.

The Rust rebuild plan keeps post-merge follow-ups about HTML diagnostics and
warning text: user items 87, 138, and 128, the source offset maps, and six
"Separate branch." lines that PR #239 recorded. On 2026-10-28 each record was
checked against `main` at `02eec937`, and each product bug was reproduced
with the debug CLI. The evidence is in
`.context/diagnostics-and-html-messages/evidence.md`.

This change defines the missing warning messages, adds the missing warning
for JavaScript page wrappers, gives saved variant slots the checks of a body,
points every `{{...}}` failure at its own characters, and resolves the six
review lines. It does not cover the serializer part of item 98,
the pointer form for `html-unused-props` and `props-not-data` (option C of
item 87), or the locations of render-time prop errors in `mokly-html`. Link
failures and the other attribute-value failures keep the attribute's start.

Decisions recorded before this plan:

- User decision 138 (2026-10-21): A, as work after the merge. The check on
  2026-10-28 found that the record's premise is out of date. `renderPage`
  already returns `warnings`, and the core removes the attributes itself.
  Option C reaches A's result without a wire change.
- User decision on the source offset maps (2026-10-28): C, the offset maps
  on a separate branch after PR #239. This branch is that branch.
- Re-review finding 2 of the 2026-10-28 implementation review: the
  coordinator chose A on 2026-10-28. The last milestone records it.

The coordinator's answers of 2026-10-28, after an independent review of the
eight items at `origin/main` `c9d402cd` and at `7edaa44e`:

- Finding 2: A. Also add one protocol sentence for the rule in force:
  callback output fails on every duplicate attribute. Rejected: B, which
  removes that failure.
- Finding 3: A. The offset maps cover CR and CRLF line ends, which html5gum
  turns into LF.
- Finding 4: A. Delete the implementation sentence. Rejected: B, a new
  sentence that repeats the one before it.
- Finding 5: A. Delete the orphan comment. Rejected: B, which removes a
  format check.
- Item 138: C. It keeps Cal's choice A: the same code, the authored message,
  one warning per page document and attribute, and the `--strict` count.
  The core collects the removed names before the source checks, so the
  warnings stay after a later failure, as with A. The message names the
  first wrapper in document order, as authored bodies do. The subject is
  `entry`, as for `.page.html` pages. Rejected: A, a TypeScript copy of the
  rule and a wire change; B, no warning.
- Item 87: B. The texts follow the contract forms and the product copy
  rules, so they need no separate approval. Rejected: A, which keeps the
  merged invocation lines; C, which changes both sides of the sidecar
  boundary.
- Items 1 and 128: open. Both recommended options add a build error, so
  they wait for Cal.

The coordinator's instruction of 2026-11-01, on Cal's behalf, after the
updated outcome rules of the shared skills:

- Item 7, the corpus bounds of the source maps: fix now, option B. Keep the
  tokenizer compatibility spans, and bound each source map by the actual
  source interval of its value. The containment condition of the earlier
  delegate brief was an implementation assumption, not a user
  requirement. Rejected: A, which excludes empty spans and loses that
  case; C, which changes the compatibility spans and their tests.
- Items 128, 1, and 6 still wait for Cal, because each recommended option
  adds a build error, and the other options change protocol text. Their
  records are follow-up items, so Milestone 4 does not hold this pull
  request. Item 1 keeps option D: wording plus file, line, and column on
  body failures, without a new rejection.
- Option C of re-review finding 2, a shared-skill rule, is outside the
  scope of this closeout. Its record stays, with no option chosen.
- Cal authorized the pull request for the completed milestones. The
  coordinator merges it.

The managing session delegates the protocol docs, READMEs, and the guide to
Claude Opus 5.5 1M at max effort, and the Rust work to Codex gpt-6.1-sol at
max effort. It checks each result before it ticks a TODO.

Contract owners:

- [HTML screens](../docs/protocol/mokly-html-screens.md), the home of the
  HTML diagnostics and the ignore-wrapper rules.
- [HTML components](../docs/protocol/mokly-html-components.md), for saved
  variant slots.
- [Entry props](../docs/protocol/mokly-entry-props.md), for
  `props-unsafe-integer`.
- [Component controls](../docs/protocol/mokly-component-controls.md), for
  `props-control-bounds`.
- [Build warnings](../docs/protocol/mokly-build-warnings.md), for the code
  table.
- The [catalogue README](../crates/mokly-catalogue/README.md), the
  [HTML README](../crates/mokly-html/README.md), and the
  [components guide](../docs/guides/authoring/components.md).

Shared files:

- `plans/rust-rebuild.md`: most open branches edit it. Edit only the lines
  of the last milestone, with the smallest edit.
- `crates/mokly-catalogue/README.md`: workspace 386 (PR #240) edits it.
- Workspace 353 (`calummoore/mokly-tests-rust-migration`) ports
  `tests/control_bounds_warnings.test.ts`,
  `tests/unsafe_control_warnings.test.ts`,
  `tests/unsafe_control_numbers.test.ts`,
  `tests/unsafe_integer_props.test.ts`, and
  `tests/unsafe_schema_numbers.test.ts` to `crates/mokly-cli/tests/`. Do not
  edit these Node tests. They and their ports count the substrings that
  Milestone 2 keeps. New tests of this plan are Rust tests in the crate that
  owns the code.
- `docs/protocol/mokly-sidecar.md` and
  `docs/protocol/mokly-sidecar-render-records.md`: workspace 407 and PR #214
  edit them. This plan edits them only if item 138 keeps option A.
- No performance plan or open performance PR touches these files. Milestone 5
  adds work to every HTML parse, so it measures the example build.

## Design

Design calls of the managing session, 2026-10-28, under the decision test:

- The invocation message puts the component path and the instance id before
  the prop pointer, in the contract form of the schema keyword and control
  messages. Reason: the line then reads from the outer name to the value.
- The rule that callback output fails on every duplicate attribute goes into
  the Document Checks of the link validation contract, beside the duplicate
  navigation attribute rule. Reason: both rules guard one check.
- The source offset maps anchor at html5gum's own chunk ends, instead of a
  second character reference decoder. Reason: one decoder cannot drift from
  another.
- 2026-11-01: option C of item 87 gets no follow-up item. Reason: the
  answer of 2026-10-28 chose B over C, so C is not open.
- 2026-11-01: the Milestone 5 timing uses the parser corpus benchmark of
  the earlier delegate, three release runs before and after. Reason: the
  benchmark isolates the parse cost that the maps add, and an example
  build adds unrelated noise.
- 2026-11-01: the reserved-name follow-up items for saved slots merge into
  `plans/follow-ups/reserved-navigation-names-in-authored-html.md`.
  Reason: one question with options A, D, B, and C covers both records.

### Warning text (item 87)

Every catalogue warning message that quotes a name uses one JSON quoting
helper with the escapes of the build warnings contract. Today the numeric and
control-bounds messages use Rust escapes, such as `"/data/a\u{1}b"`, and
`config_warnings` and the subject printer each have their own JSON quoting.

`props-unsafe-integer` keeps its text in one formatter in `numeric_warnings`:

- Saved props: `prop <JSON-quoted-pointer> is outside the JavaScript safe integer range and uses the nearest binary64 value`.
- A component invocation, from an HTML component element or an authenticated
  JavaScript instance draft:
  `component <JSON-quoted-path> instance <JSON-quoted-id> prop <JSON-quoted-pointer> is outside the JavaScript safe integer range and uses the nearest binary64 value`.
  The subject stays the rendered entry. Instances with different ids no
  longer merge into one line, and an invocation no longer merges with the
  entry's own warning.
- Schema keywords and controls keep their defined messages.

`props-control-bounds` names the prop as a JSON pointer:
`saved prop <JSON-quoted-pointer> is outside its control bounds`.
`html-ignore-attribute` keeps
`unknown attribute <name> on <<element>> is ignored`.

### Page callback wrapper warnings (item 138)

The sidecar permits ignore wrappers only in `renderPage` documents. The core
already removes unknown wrapper attributes from all callback HTML, with the
rule that authored bodies use. Under option C the core reports what it
removes: one `html-ignore-attribute` warning per page callback document and
attribute name, with the page's `entry` subject and the message of authored
bodies. The warning stays with a reused document, like other composition
warnings. The sidecar wire, the render records, and the TypeScript sidecar
do not change. `--strict` counts the new warning.

- The core parses the callback document and collects the removed names
  before the page and source checks run. A later failure then keeps the
  warnings, as the sidecar's own warnings do.
- `ignore_checks::filter_tree` walks the tree in reverse document order. The
  warning for one attribute names the first wrapper in document order that
  carries it, as `templates.rs` does for authored bodies.

### Authored HTML checks (item 128 and finding 1)

Saved variant slots run the body checks through `templates::validate` with
the saved-slot role. That role skips the forbidden and unknown element checks
today. Under item 128 A the role applies them, and each failure names the
slot's front matter field.

Reserved navigation names, `data-mokly-link` and `data-mokly-link-control…`,
fail in bodies and callback output today, but at render time, with the route
and the text "in consumer output". On a saved-slot ignore wrapper they only
warn "is rejected", and only `mokly-ignore` evaluates their values. Under
finding 1 C, catalogue validation fails each reserved name in authored HTML
with `html-attribute` and `<name> is reserved for Mokly`. A body failure names
the attribute's file, line, and column. A saved-slot failure names the slot
field. The token boundary reports the reserved names instead of a flag. The
render-time check stays as a backstop and names its input: authored HTML or
consumer output. The reserved-name form of `html-ignore-attribute` goes.

### Callback duplicate attributes (finding 2)

`source_checks::validate` fails every duplicate attribute in callback output,
and it names each one a navigation attribute. Under option A a navigation
name keeps `duplicate navigation attribute <name>`, and any other name gets
`duplicate attribute <name> in consumer output`. The rule does not change.

### Source offset maps (decision C and finding 3)

A text token and an attribute value carry decoded bytes. Character
references, CRLF and CR line ends, and replaced NUL characters make the
decoded offsets differ from the source offsets. An attribute's span also
starts at its name. So a `{{...}}` failure after a reference, after a CRLF,
or inside an attribute value points at the wrong line or column.

- The Mokly token types keep their html5gum-compatible spans. An attribute
  value also gets its own value span, from html5gum's `AttributeValue` event.
  Each text token and attribute value gets a source offset map.
- The driver's emitter tracks the source position from `move_position`. It
  records a breakpoint at each html5gum chunk end, in `emit_string` and
  `push_attribute_value`, before the callback emitter folds the chunks.
- Inside a chunk, a walk aligns the source and the decoded bytes. CRLF and CR
  count as one LF, and the LF that html5gum skips after a CR is skipped. A
  chunk that does not align, such as a character reference, maps each offset
  to its first source byte. A value without such chunks has an empty map.
- The recorder lives in its own module, because `html_driver_events.rs` has
  281 lines.
- `templates.rs` maps each `{{...}}` offset in text and in attribute values.
  Other failures keep their current locations.

### Small fixes (findings 4 and 5)

Delete the sentence "One parser and one renderer serve both." from the HTML
screens contract, and delete the comment without a pattern from
`.prettierignore`.

## Open decisions

Items 128, 1, and 6 wait for Cal. Each has a complete follow-up item, so it
does not hold the pull request. "New gate" marks an option that adds a build error,
a rejection, or stricter validation.

- Item 128, saved variant slot element checks. Severity Medium, effort
  Medium. Recommended: A, apply the body element checks. Alternatives: B,
  state that saved slots skip them; C, warn instead. A: new gate. C: a
  warning that strict builds count. Follow-up item:
  `plans/follow-ups/saved-variant-slot-checks.md`.
- Item 1, reserved navigation names in authored HTML. Severity Medium, effort
  Medium. Recommended: C, one validation rule for all authored HTML.
  Alternatives: A, wording only; D, A plus file, line, and column on body
  failures; B, A plus value evaluation on saved-slot `mokly-ignore-scope`.
  A, D, and B change the protocol's saved-slot warning text. B and C: new
  gate. Follow-up item:
  `plans/follow-ups/reserved-navigation-names-in-authored-html.md`.
- Item 6, saved slots skip the duplicate navigation check. Severity Low,
  effort Medium. Recommended: B, the shared authored-HTML validation.
  Alternatives: A, run the source checks on saved slots; C, state the skip
  in the protocol. A and B: new gate. Follow-up item:
  `plans/follow-ups/saved-slot-duplicate-navigation.md`.

Outside the scope of this closeout, per the coordinator on 2026-11-01:

- Option C of re-review finding 2 proposes a rule in the shared
  `implementation-review` skill of `futex-ai/skills`. It changes no Mokly
  behaviour and blocks no milestone. It stays pending, with no option
  chosen. Follow-up item: `plans/follow-ups/review-missed-tick-rule.md`.

## Milestone 1: Documentation and protocol

The protocol docs state the requirements and the decisions for the answered
options. The doc changes for items 1 and 128 move to Milestone 4, because
they wait for Cal. Where an answer chose between options, the
page states the decision in force with the rejected alternative and the
reason, in one or two sentences. Each changed page gets the line
`Status: In progress under the [diagnostics and HTML messages plan](../../plans/diagnostics-and-html-messages.md).`
below its title until its behaviour is implemented.

- [x] `docs/protocol/mokly-html-screens.md`:
  - [x] Add `html-ignore-attribute` to the Diagnostics table, and define its
        message (item 87).
  - [x] Unknown attributes on ignore wrappers in a page callback document
        warn once per page and attribute (item 138 C).
  - [x] A `{{...}}` failure names the line and column of its own `{{`,
        also after character references, in attribute values, and with CRLF
        or CR line ends. A `{{` that a character reference produces names
        the start of that reference (offset maps, finding 3 A).
  - [x] Delete "One parser and one renderer serve both." (finding 4 A).
- [x] `docs/protocol/mokly-link-validation.md`: state the rule in force that
      callback output fails on every duplicate attribute (finding 2 A).
- [x] `docs/protocol/mokly-entry-props.md`: define the saved-prop and the
      invocation messages (item 87 B).
- [x] `docs/protocol/mokly-component-controls.md`: define the
      `props-control-bounds` message (item 87 B).
- [x] `docs/protocol/mokly-build-warnings.md`: the `html-ignore-attribute`
      row names authored bodies and page callback documents (item 138 C).
- [x] Keep each page under 250 lines. Run `npm run format:check` and
      `node --import tsx --test tests/markdown_links.test.ts`.
- Done in `dabf30d2`. The docs delegate's design calls and probes:
  `.context/diagnostics-and-html-messages/m1-probes/` and its reply in
  session `7712180f`. The HTML screens page has 249 lines, so Milestone 4
  splits it before it adds text.

## Milestone 2: Warning text

Item 87 B in `mokly-catalogue` and `mokly-html`. Write each failing test
before its fix.

- [x] Tests that fail on `main`:
  - [x] Catalogue unit tests: the invocation message, JSON quoting of a key
        with U+0001 and U+0085, and the pointer form of
        `props-control-bounds`.
  - [x] `mokly-html` composition tests: two HTML invocations give two lines
        that name the component and the instance, and an invocation stays
        separate from the entry's own warning. A mocked fragment renderer
        gives a JavaScript instance draft the same message form.
  - [x] A CLI test with an HTML catalogue checks the exact lines.
- [x] Share one JSON quoting helper, and use it in every catalogue warning
      message that quotes a name.
- [x] Add the invocation formatter to `numeric_warnings`, and call it from
      `components.rs` and `javascript.rs`. Split `numeric_warnings.rs`
      (249 lines) so that it stays under 300 lines.
- [x] Name the prop as a JSON pointer in `control_warnings`.
- [x] Keep the substrings
      `is outside the JavaScript safe integer range and uses the nearest binary64 value`
      and `is outside its control bounds`.
- [x] Run the crate tests, `cargo clippy`, and `cargo fmt --all -- --check`.
- [x] Review of `36ad15e8`: type the invocation as a `Field` variant in
      `numeric_warnings`, so that no formatter argument is ignored. Done in
      `7eb5d776`.
- [x] Review of `7eb5d776`: keep the shared message tail of
      `props-unsafe-integer` in one place, so that a wording change needs
      one edit. Done in `0125140a`.
- Done in `36ad15e8`. Red and green runs:
  `.context/diagnostics-and-html-messages/m2-red.log` and `m2-green.log`.

## Milestone 3: Callback HTML diagnostics

Item 138 C and finding 2 A in `mokly-html`.

- [x] Tests that fail on `main`:
  - [x] A composition test with a mocked page fragment: wrappers with
        `typo`, `extra`, and `class` give three warnings with the `entry`
        subject and the authored message. A repeated attribute warns once.
  - [x] A CLI test with a `definePage` page: the warnings print, and
        `--strict` exits 1 and keeps the earlier output.
  - [x] A `source_checks` test: `<p class=a class=b>` in callback output
        fails with `duplicate attribute class in consumer output`.
        Navigation names keep their text.
- [x] Return the removed names from the callback tree filter, and report
      the warnings for page callback documents. Make
      `html_tokens::ignore_warning_message` public for this.
- [x] Word the duplicate attribute failure by name.
- [x] Do not change the sidecar wire, the render records, or the TypeScript
      sidecar.
- [x] Run the crate tests, `cargo clippy`, and `cargo fmt --all -- --check`.
- Done in `c6b74667`. Red and green runs:
  `.context/diagnostics-and-html-messages/m3-red.log` and `m3-green.log`.

## Milestone 4: Authored HTML checks

Item 128 A and finding 1 C in `mokly-catalogue` and `mokly-html`. This
milestone waits for Cal's answers on items 128, 1, and 6. On 2026-11-01 its
work moved to the follow-up items of "Open decisions", with every fact of
the TODOs below. This branch does not implement it. A later branch applies
the answers.

- [ ] `docs/protocol/mokly-html-screens.md`: a reserved navigation name
      fails in a body, a saved slot, and callback output. Authored HTML
      fails with `html-attribute` at the attribute or the slot field. Remove
      "a saved slot warns that the name is rejected" (finding 1 C).
- [ ] `docs/protocol/mokly-html-components.md`: saved slot fragments use the
      body checks, including forbidden and unknown elements and reserved
      names. Each failure names the slot field (item 128 A, finding 1 C).
- [ ] Tests that fail on `main`:
  - [ ] Catalogue tests: a saved slot with `script`, `html`, `head`,
        `body`, `base`, `mokly-foo`, or an unknown hyphenated element fails
        with `html-element` at the slot field.
  - [ ] Catalogue tests: a reserved name on a saved-slot wrapper, on an
        ordinary saved-slot element, and in a body fails with
        `html-attribute`. A body failure names the attribute's line and
        column.
  - [ ] A CLI test: a saved slot with `<script>` fails and writes no output.
- [ ] Move the attribute checks out of `templates.rs` (271 lines) into
      their own module before adding checks.
- [ ] Apply the element checks to the saved-slot role.
- [ ] Report reserved names and their spans from the token boundary, and
      fail them in validation for both roles. Remove the reserved-name
      warning form.
- [ ] Word the render-time backstop by input: authored HTML or consumer
      output.
- [ ] Update the tests that pin the replaced behaviour, and keep each
      assertion that still holds:
      `reserved_navigation_warning_names_rejection_instead_of_ignoring`,
      `saved_slot_reserved_wrapper_attributes_stay_visible_to_composition`,
      `reserved_navigation_fields_remain_visible_and_fail_as_before`, and
      `saved_variant_slots_keep_element_failures_deferred` in
      `crates/mokly-catalogue/tests/ignore_attribute_tests.rs`, which locks
      in the current item 128 behaviour. Record each changed expectation and
      its decision in the commit body.
- [ ] `docs/guides/authoring/components.md`: saved slot HTML follows the
      body element rules (item 128 A).
- [ ] `crates/mokly-catalogue/README.md` and `crates/mokly-html/README.md`:
      the saved slot checks and the reserved-name rule.
- [ ] Run the crate tests, `cargo clippy`, and `cargo fmt --all -- --check`.

## Milestone 5: Source offset maps

The decided offset maps and finding 3 A in `mokly-catalogue`.

- [x] Tests that fail on `main`, one per evidence case: attribute values,
      character references in text and in values, CRLF and CR in text and
      in values, and a `{{` from `&lbrace;&lbrace;` after another
      reference. Add cases that pass on `main` and must keep passing: a NUL
      in a value, multi-byte UTF-8, a leading byte order mark, and
      unquoted, single-quoted, and double-quoted values.
- [x] Add the value span and the source offset map to the token types.
- [x] Record the breakpoints in a new module beside the driver.
- [x] Map each `{{...}}` offset in `templates.rs`.
- [x] Add a property test over the vendored html5lib corpus and the
      differential fixtures. Each map is monotonic, each aligned byte equals
      its source byte or a CR, and each chunk end matches html5gum.
- [x] Item 7, option B: keep the tokenizer compatibility spans, and bound
      each map by the actual source interval of its value. Add a named test
      for `<!doctype html><script><`: the decoded `<` maps to byte 23, with
      the interval from 23 to 24.
- [x] Time three runs of the parser corpus benchmark before and after the
      change. Save the numbers under
      `.context/diagnostics-and-html-messages/`. If parsing slows by more
      than 2%, record maps only for the checks' sink.
- [x] Run the crate tests, `cargo clippy`, and `cargo fmt --all -- --check`.
- [x] Review of `2e6d62a1`: make the two corpus assertions inside `if`
      blocks unconditional, with the same meaning. Done in `63cdca52`.
- Done in `2e6d62a1`. The corpus timing median fell from 1337.466 ms to
  1088.449 ms, so maps stay on for both sinks. Evidence:
  `.context/diagnostics-and-html-messages/m5-measure.md`, `m5-item7-red.log`,
  `m5-corpus-mutation-red.log`, and `m5-green.log`.

## Milestone 6: READMEs and cleanup

The README parts for items 1 and 128 move to Milestone 4.

- [x] `crates/mokly-catalogue/README.md`: the warning formatter and the
      JSON quoting helper under Key Code. Done in `50adf49a`.
- [x] `crates/mokly-catalogue/README.md`: the source offset maps. Done in
      `55f16cad`.
- [x] `crates/mokly-html/README.md`: page callback warnings, invocation
      warnings, and duplicate attribute text. Done in `50adf49a`.
- [x] `docs/protocol/mokly-build-warnings.md`: the `html-ignore-attribute`
      row also names saved variant slots, which warn today. Done in
      `50adf49a`.
- [x] Delete the comment without a pattern from `.prettierignore` (finding 5
      A). Done in `2b77ae17`.
- [x] Remove the status lines of the build warnings, entry props, and
      component controls pages. Done in `50adf49a`.
- [x] Remove the status line of the HTML screens page after Milestone 5.
      Done in `55f16cad`.

## Milestone 7: Verification, bookkeeping, commit, review, and pull request

- [ ] Smoke test: run `npm run build`, rerun every probe of the evidence
      file, and build the example catalogue with
      `npx mokly build --config examples/basic/mokly.config.json --strict --out ../../.context/example`.
      Save the results in `.context/diagnostics-and-html-messages/after.md`.
- [ ] Run `cargo xtask check --suite repository`, then the complete gate
      `cargo xtask check`.
- [x] ~~Edit `plans/rust-rebuild.md`.~~ Main deleted that plan in
      `133782a9` and moved its open work into `plans/follow-ups/`, so the
      bookkeeping below replaces these edits (2026-11-01).
- [x] Delete the follow-up items that this branch resolves, merge the
      reserved-name items, and add the items of "Open decisions" that have
      no file. Done in `fdeeb825`: open follow-up items went from 151 to 147.
- [x] Delete `plans/follow-ups/template-source-offset-maps.md` when
      Milestone 5 lands. Done in `55f16cad`; 146 open follow-up items
      remain.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Apply the fix rule: fix
      the `fix now` findings, record follow-up items for the rest, re-review
      once, and report.
- [ ] Delete this plan in the last commit before the pull request. Give its
      dated decisions and a permalink in the pull request description.
- [ ] Open the pull request. The coordinator merges it.

## Post-merge follow-up (non-blocking)

- None. Option C of item 87 is not open, as the design calls say.
