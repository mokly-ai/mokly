# Diagnostics And HTML Messages

Status: Active. On branch
`conductor/rust-rebuild-87-diagnostics-and-html-messages`, no pull request
yet. The plan closes when its PR merges. The implementation waits for the
open decisions below.

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
  Option C below reaches A's result without a wire change. Cal must confirm C.
- User decision on the source offset maps (2026-10-28): C, the offset maps
  on a separate branch after PR #239. This branch is that branch.
- Re-review finding 2 of the 2026-10-28 implementation review: the
  coordinator chose A on 2026-10-28. The last milestone records it.

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

Recommended options are in force only after Cal answers. "New gate" marks an
option that adds a build error, a rejection, or stricter validation. "Removes
functionality" marks an option that removes behaviour on `main`. Findings 1
to 5 are new numbers of this plan. Items 87, 128, and 138 keep their user
item numbers.

- Item 138, JavaScript page wrappers get no attribute warning. Severity
  Medium, effort Medium (estimate) for C. Recommended: C, the core warns where
  it removes the attributes. Alternatives: A, the user's 2026-10-21 choice,
  sidecar transport, Large; B, no warning, Small (estimate). A and C: new
  gate under `--strict`.
- Item 128, saved variant slot element checks. Severity Medium (estimate),
  effort Small (estimate). Recommended: A, apply the body element checks.
  Alternative: B, state that saved slots skip them. A: new gate.
- Finding 1, reserved navigation names in authored HTML. Severity Low
  (estimate), effort Medium (estimate). Recommended: C, one validation rule
  for all authored HTML. Alternatives: A, rewording only; B, A plus value
  evaluation on saved-slot `mokly-ignore-scope`. B and C: new gate.
- Finding 2, duplicate callback attributes named as navigation attributes.
  Severity Low, effort Small. Recommended: A, word by name. Alternative: B,
  fail only navigation names and adapted elements, which removes
  functionality.
- Finding 3, CRLF and CR line ends shift `{{...}}` failure locations.
  Severity Low, effort Small inside the offset maps. Recommended: A, cover
  them in the offset maps.
- Finding 4, a protocol sentence describes the implementation. Severity Low,
  effort Small. Recommended: A, delete it. Alternative: B, replace it with a
  requirement.
- Finding 5, a `.prettierignore` comment without a pattern. Severity Low,
  effort Small. Recommended: A, delete it. Alternative: B, ignore the
  protocol fixtures again, which removes a format check.
- Item 87, the missing warning messages. Severity Low, effort Medium for B.
  Recommended: B. Alternatives: A, define the current messages, Small
  (estimate); C, B plus the pointer form for `html-unused-props` and
  `props-not-data`, Large.

## Milestone 1: Documentation and protocol

The protocol docs state the requirements and the decisions for the answered
options. Each TODO names the recommended option. If an answer differs, update
the TODO before this milestone starts. Where Cal chose between options, the
page states the decision in force with the rejected alternative and the
reason, in one or two sentences. Each changed page gets the line
`Status: In progress under the [Diagnostics And HTML Messages](../../plans/diagnostics-and-html-messages.md) plan.`
below its title until its behaviour is implemented.

- [ ] `docs/protocol/mokly-html-screens.md`:
  - [ ] Add `html-ignore-attribute` to the Diagnostics table, and define its
        message (item 87).
  - [ ] Unknown attributes on ignore wrappers in a page callback document
        warn once per page and attribute (item 138 C).
  - [ ] A reserved navigation name fails in a body, a saved slot, and
        callback output. Authored HTML fails with `html-attribute` at the
        attribute or the slot field. Remove "a saved slot warns that the
        name is rejected" (finding 1 C).
  - [ ] A `{{...}}` failure names the line and column of its own `{{`,
        also after character references, in attribute values, and with CRLF
        or CR line ends. A `{{` that a character reference produces names
        the start of that reference (offset maps, finding 3 A).
  - [ ] Delete "One parser and one renderer serve both." (finding 4 A).
- [ ] `docs/protocol/mokly-html-components.md`: saved slot fragments use the
      body checks, including forbidden and unknown elements and reserved
      names. Each failure names the slot field (item 128 A, finding 1 C).
- [ ] `docs/protocol/mokly-entry-props.md`: define the saved-prop and the
      invocation messages (item 87 B).
- [ ] `docs/protocol/mokly-component-controls.md`: define the
      `props-control-bounds` message (item 87 B).
- [ ] `docs/protocol/mokly-build-warnings.md`: the `html-ignore-attribute`
      row names authored bodies, saved slots, and page callback documents
      (item 138 C).
- [ ] Keep each page under 250 lines. Run `npm run format:check` and
      `node --import tsx --test tests/markdown_links.test.ts`.

## Milestone 2: Warning text

Item 87 B in `mokly-catalogue` and `mokly-html`. Write each failing test
before its fix.

- [ ] Tests that fail on `main`:
  - [ ] Catalogue unit tests: the invocation message, JSON quoting of a key
        with U+0001 and U+0085, and the pointer form of
        `props-control-bounds`.
  - [ ] `mokly-html` composition tests: two HTML invocations give two lines
        that name the component and the instance, and an invocation stays
        separate from the entry's own warning. A mocked fragment renderer
        gives a JavaScript instance draft the same message form.
  - [ ] A CLI test with an HTML catalogue checks the exact lines.
- [ ] Share one JSON quoting helper, and use it in every catalogue warning
      message that quotes a name.
- [ ] Add the invocation formatter to `numeric_warnings`, and call it from
      `components.rs` and `javascript.rs`. Split `numeric_warnings.rs`
      (249 lines) so that it stays under 300 lines.
- [ ] Name the prop as a JSON pointer in `control_warnings`.
- [ ] Keep the substrings
      `is outside the JavaScript safe integer range and uses the nearest binary64 value`
      and `is outside its control bounds`.
- [ ] Run the crate tests, `cargo clippy`, and `cargo fmt --all -- --check`.

## Milestone 3: Callback HTML diagnostics

Item 138 C and finding 2 A in `mokly-html`.

- [ ] Tests that fail on `main`:
  - [ ] A composition test with a mocked page fragment: wrappers with
        `typo`, `extra`, and `class` give three warnings with the `entry`
        subject and the authored message. A repeated attribute warns once.
  - [ ] A CLI test with a `definePage` page: the warnings print, and
        `--strict` exits 1 and keeps the earlier output.
  - [ ] A `source_checks` test: `<p class=a class=b>` in callback output
        fails with `duplicate attribute class in consumer output`.
        Navigation names keep their text.
- [ ] Return the removed names from the callback tree filter, and report
      the warnings for page callback documents. Make
      `html_tokens::ignore_warning_message` public for this.
- [ ] Word the duplicate attribute failure by name.
- [ ] Do not change the sidecar wire, the render records, or the TypeScript
      sidecar.
- [ ] Run the crate tests, `cargo clippy`, and `cargo fmt --all -- --check`.

## Milestone 4: Authored HTML checks

Item 128 A and finding 1 C in `mokly-catalogue` and `mokly-html`.

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
      and `reserved_navigation_fields_remain_visible_and_fail_as_before`.
      Record each changed expectation and its decision in the commit body.
- [ ] Run the crate tests, `cargo clippy`, and `cargo fmt --all -- --check`.

## Milestone 5: Source offset maps

The decided offset maps and finding 3 A in `mokly-catalogue`.

- [ ] Tests that fail on `main`, one per evidence case: attribute values,
      character references in text and in values, CRLF and CR in text and
      in values, and a `{{` from `&lbrace;&lbrace;` after another
      reference. Add cases that pass on `main` and must keep passing: a NUL
      in a value, multi-byte UTF-8, a leading byte order mark, and
      unquoted, single-quoted, and double-quoted values.
- [ ] Add the value span and the source offset map to the token types.
- [ ] Record the breakpoints in a new module beside the driver.
- [ ] Map each `{{...}}` offset in `templates.rs`.
- [ ] Add a property test over the vendored html5lib corpus and the
      differential fixtures. Each map is monotonic, each aligned byte equals
      its source byte or a CR, and each chunk end matches html5gum.
- [ ] Time three example builds before and after the change. Save the
      numbers under `.context/diagnostics-and-html-messages/`. If parsing
      slows by more than 2%, record maps only for the checks' sink.
- [ ] Run the crate tests, `cargo clippy`, and `cargo fmt --all -- --check`.

## Milestone 6: READMEs, guide, and cleanup

- [ ] `crates/mokly-catalogue/README.md`: saved slot checks, reserved names,
      source offset maps, and the warning formatter under Key Code.
- [ ] `crates/mokly-html/README.md`: page callback warnings, reserved names,
      and duplicate attribute text.
- [ ] `docs/guides/authoring/components.md`: saved slot HTML follows the
      body element rules (item 128 A).
- [ ] Delete the comment without a pattern from `.prettierignore` (finding 5
      A).
- [ ] Remove the status line from each protocol page whose behaviour is now
      implemented.

## Milestone 7: Verification, bookkeeping, commit, review, and pull request

- [ ] Smoke test: run `npm run build`, rerun every probe of the evidence
      file, and build the example catalogue with
      `npx mokly build --config examples/basic/mokly.config.json --strict --out ../../.context/example`.
      Save the results in `.context/diagnostics-and-html-messages/after.md`.
- [ ] Run `cargo xtask check --suite repository`, then the complete gate
      `cargo xtask check`.
- [ ] In `plans/rust-rebuild.md`, with the smallest edit:
  - [ ] Tick items 87, 138, and 128, and the source offset maps follow-up,
        as the answers resolve them.
  - [ ] Add one resolved line under each outside-scope line that this
        change fixes.
  - [ ] Under "Re-review finding 2", add: the coordinator chose A on
        2026-10-28, because the `plans` skill says to tick a TODO when its
        work is complete, and Cal's decision A was done in `e236ea78`. Then
        tick the item.
  - [ ] Add one follow-up line for Cal: option C of re-review finding 2, a
        rule in the shared `implementation-review` skill.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
- [ ] The coordinator opens the pull request when every other milestone
      TODO is ticked. Put its link in the status paragraph.

## Post-merge follow-up (non-blocking)

- [ ] Possible later change, option C of item 87: the JSON pointer form and
      JSON quoting for `html-unused-props` and the sidecar's
      `props-not-data`. Not decided.
