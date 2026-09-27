# Styled Link Control Ancestor Rule

Narrow the interactive-ancestor rule for styled link controls
(`MockLink asChild`) to ancestors that own a click or key press, make the
ancestor and descendant build errors name the offending element, and state the
complete rule in the Links guide. The contract lives in the
[styled link controls protocol](../docs/protocol/mokly-link-controls.md); the
original delivery is recorded in
[MockLink Child Controls](./mocklink-child-controls.md).

## Background

`src/build/link_control_nodes.ts` uses one `isInteractive` predicate for two
checks. For descendants of the control it is correct: any focusable or
interactive element inside a link is a nested target. For ancestors it is too
broad. The build stops for three common structures that do not create two
targets for one click or key press:

- `<main tabIndex={-1}>`, the skip-to-content focus target. A negative
  `tabindex` only permits focus from code; a zero value is the
  keyboard-scrollable region pattern. Neither adds a click target.
- Content inside `<details>`. Only `<summary>` is activatable.
- Group roles such as `menubar`, `tablist`, `listbox`, `tree`, and
  `radiogroup`. A group is not a click target.

PR #42 shipped the descendant check and originally excluded `tabindex` from
the ancestor check. A Low-severity review item then rejected every ancestor
`tabindex`, including negative values, to match the specification wording
rather than a demonstrated hazard. The error `has an interactive ancestor`
does not name the element or the attribute that caused it, and the Links
guide states only the descendant half of the rule. The cloud repository plans
to remove the Reference page that carried the full rule and redirect its
address to the Links guide, so the guide must become self-contained.

## Decisions

- An **activatable ancestor** is an HTML `a`, `area`, `button`, `input`,
  `select`, `textarea`, `label`, `summary`, `iframe`, `object`, or `embed`;
  an `audio` or `video` element with `controls`; an editable element
  (`contenteditable` other than `false`); or an element whose `role` list
  contains `button`, `link`, `checkbox`, `combobox`, `menuitem`,
  `menuitemcheckbox`, `menuitemradio`, `option`, `radio`, `searchbox`,
  `slider`, `spinbutton`, `switch`, `tab`, `textbox`, or `treeitem`.
- Ancestor `tabindex` of any value, a `details` ancestor, and the group roles
  `gridcell`, `listbox`, `menu`, `menubar`, `radiogroup`, `tablist`, `tree`,
  and `treegrid` are permitted. A plain link directly inside `menubar` or
  `tablist` is an ARIA structure question for the author, not broken HTML;
  Mokly builds catalogues and is not an accessibility checker.
- The descendant rule is unchanged. `details` stays rejected as a descendant
  because a `details` without an explicit `summary` renders a clickable
  default summary.
- Inactive-state propagation from ancestors (`inert`, `aria-disabled`,
  `aria-busy`, disabled `fieldset`) is unchanged.
- Root roles other than `button` and `link` stay rejected; widening the root
  contract is out of scope.
- Errors name the first offending element as `<tag>` or
  `<tag attribute="value">`, where the attribute is the one that made it
  interactive (`role`, `contenteditable`, `controls`, or `tabindex`). The
  inline-handler errors name the attribute with the same helper. Templates,
  with the ancestor example showing a structure that builds after this plan:

  ```text
  <route>: MockLink child control is inside <div role="menuitem">; move the control outside it
  <route>: MockLink child control contains <button>; remove the nested interactive element
  ```

- Existing tests that assert `tabindex` ancestors fail are inverted on
  purpose. This is the only mainline behavior this plan removes.

## Milestone 1: Define the contract

Update the protocol, design, and guide documentation so they state the
narrowed ancestor rule, the permitted containers, and the error formats before
any code changes.

- [ ] Fetch `origin/main`, record the source tip, and audit main's additions
      from the branch point so the integration preserves mainline features.
- [ ] Rewrite the ancestor paragraph of the Authoring Contract in
      `docs/protocol/mokly-link-controls.md`: define activatable ancestors
      with the exact tag and role lists above, state that ancestor `tabindex`,
      `details` content, and group roles are permitted, keep the descendant
      rule and say why `details` remains a rejected descendant, and specify
      both error message templates. Point Delivery Status at this plan until
      the code lands.
- [ ] Replace the `mokly-design-links.md` sentence that says `asChild`
      deliberately rejects interactive ancestors including `details` with the
      narrowed rule.
- [ ] Extend "Style your own control" in `docs/guides/authoring/links.md` so
      it states both halves of the rule in reader-facing copy: no interactive
      descendants, and not inside a link, button, label, summary, editable
      region, or element with an activatable role. Keep the guide tests, the
      copy exclusions, and Prettier passing; do not link to repository files.
- [ ] Check `README.md`, `docs/architecture/build-pipeline.md`, and the viewer
      README for the old rule wording and update any match.
- [ ] Validate the changed Markdown with `npx prettier --check` and review the
      diff.

## Milestone 2: Narrow the rule and name the element

Deliver the activatable-ancestor predicate, the descriptive errors, and full
regression coverage. The catalogue builds identically for every document that
built before, plus the newly permitted structures.

- [ ] Add failing regressions in `tests/link_control_metadata.test.ts`:
      permitted ancestors (`tabindex` `0`, `3`, and `-1`; `main tabindex="-1"`;
      `details` content; each permitted group role) produce the anchor;
      rejected ancestors (`a`, `button`, `label`, `summary`, editable,
      `video controls`, and each activatable role) fail with the element and
      attribute named; descendant `tabindex`, `details`, and group roles still
      fail with the element named.
- [ ] Add compile-level regressions in `tests/build_link_controls.test.ts`:
      `<main tabIndex={-1}>` wrapping an `asChild` control builds and emits the
      anchor in every generated view; a `<summary>` ancestor fails with the
      element named. Update assertions that match the old message text.
- [ ] Split the predicates in `src/build/link_control_nodes.ts`: keep
      `isInteractive` for descendants, add an activatable-ancestor predicate
      with its own tag and role sets, and add one element-description helper
      shared by the ancestor, descendant, and inline-handler errors. Keep the
      module near 200 lines; move the sets into a sibling module if it grows.
- [ ] Use the ancestor predicate in `src/build/link_controls.ts` and throw the
      ancestor message with the first offending ancestor.
- [ ] Name the offending element in the descendant and inline-handler messages
      in `validateControl`.
- [ ] Search the repository for the old message text (`interactive ancestor`,
      `another interactive control`) and update every match.
- [ ] Run the focused suites (`link_control_metadata`, `build_link_controls`,
      `design_links`, guides), then `cargo xtask check`.
- [ ] Smoke test: in a temporary fixture project, build the three formerly
      failing structures with `node dist/cli/bin.js build` and confirm success;
      wrap a control in `<button>` and confirm the new message prints.

## Milestone 3: Deliver and review

Complete the required delivery sequence after validation passes.

- [ ] Set the protocol Delivery Status back to Implemented and mark this plan
      complete in `plans/README.md` once verified.
- [ ] Inspect the diff and deletions against `origin/main` with
      `git diff --name-status origin/main` and
      `git diff --diff-filter=D --name-status origin/main`; confirm the only
      removed behavior is the inverted `tabindex` ancestor tests authorized
      above, and record it in the commit body.
- [ ] Run `git add -A`, commit using Conventional Commits, and push the
      branch.
- [ ] After the push, review the complete local diff against `origin/main`
      using `docs/implementation-review-prompt.md` and report each finding with
      a number, severity, impact, lettered options, and a recommendation
      without changing the implementation.

## Post-merge follow-up (non-blocking)

- When the cloud site renders the package release containing this change,
  confirm the Links guide shows the complete rule and that the old Reference
  address opens it.
- Consider a later plan for root roles such as `menuitem` and `tab` so a
  styled control can be a correct child of `menubar` or `tablist`.
