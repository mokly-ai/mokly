# Prepared PostCSS Child Starts Only From prepareContext

Status: Active. On branch `calummoore/mokly-earlier-postcss-start-bdhv`, no pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says.

Since #470, the pool sends a `prepareContext` request before each `bundle`
request with a PostCSS preparation, and that request starts the prepared
child. The `bundle` case of the sidecar session still starts the preparation
when no earlier request started it. No product flow uses that second start
path, so it is a leftover layer that each later change to the child start must
keep in step. This change removes the start from the `bundle` case. The
`bundle` request keeps its `preparation` member and its release of the context
on failure. After a failed `prepareContext`, the first `processCss` request of
the context starts the child, as for a context without preparation, so no
output changes. The change also records the closed light-entry experiment and
opens a follow-up item for the stylesheet chain of a warm `examples/basic`
start. It makes no speed claim.

Decisions, all by the performance orchestrator under the delegation of the
user:

- 2026-11-22: option B of the follow-up item
  `plans/follow-ups/prepared-child-single-start.md`, first inside the
  light-entry pull request. Alternatives: keep the `bundle`-side start (A),
  stop sending the `preparation` member (C), move only the tests (D), and send
  only the context (E). Reason: it leaves the one start path that the product
  uses, keeps the release, and changes no output.
- 2026-11-22: the light-entry change closed with option A after the official
  mokly-cloud check of its last form failed, so this change gets its own pull
  request. The closed experiment record holds the measurements.
- 2026-11-22: the protocol text, approved as proposed, with two conditions. Red
  tests come first for the changed rule. The memory page must still count a
  child that a `processCss` request starts after a failed `prepareContext`.
- 2026-11-22: the memory page keeps the approved sentence and adds "They count
  a child that a `processCss` request starts in the same way, also after a
  failed `prepareContext`." Alternative: name `processCss` in the approved
  sentence instead. Reason: the added sentence names the failure case.
- 2026-11-22: the stylesheet chain gets its own open follow-up item with its
  split, its options, and a projection and a memory cost for each. No code.

Design calls, my own:

- 2026-11-22: the two red tests run the real sidecar process, because the rule
  concerns which request forks the child. Each test watches the
  `postcss-start` operation events between the replies.
- 2026-11-22: the session tests of prepared children send `prepareContext`
  before their `bundle` request, as the pool does, and keep every assertion.
  The test "Bundle starts preparation before compilation and does not await
  it" loses only its two start assertions, under the removal rule of the
  `testing` skill, and gets a name for its reuse assertions.

Contract owners:

- [Prepared contexts](../docs/protocol/mokly-sidecar-postcss.md#prepared-contexts).
- [Sidecar memory sampling](../docs/protocol/mokly-sidecar-memory.md#sampling-and-recycling).
- The [sidecar README](../packages/mokly/src/sidecar/README.md) and the
  [sidecar crate README](../crates/mokly-sidecar/README.md).

Replaced ways:

- A `bundle` request with a preparation starts the child when no earlier
  request did → only `prepareContext` starts a prepared child. Consumers: the
  `bundle` case of `packages/mokly/src/sidecar/session.ts` and the session
  tests of prepared children. Moved and deleted in Milestone 3.

## Milestone 1: Documentation and protocol

Depends on: none

The approved text states the single start path and the memory count.

- [ ] Change the "Prepared Contexts" sentence of
      `docs/protocol/mokly-sidecar-postcss.md`. The page stays at 250 lines.
- [ ] Change the discovery paragraph of
      `docs/protocol/mokly-sidecar-memory.md`.
- [ ] Update the `session.ts` and `postcss.ts` entries of
      `packages/mokly/src/sidecar/README.md` and the doc comment of
      `Pool::prepare_context`.

## Milestone 2: Red tests

Depends on: 1

- [ ] A `bundle` request with a preparation and no earlier `prepareContext`
      starts no child, and its first `processCss` request starts it.
- [ ] After a failed `prepareContext`, the first `processCss` request of the
      context starts the child.
- [ ] Run both and record that they fail.

## Milestone 3: The single start path

Depends on: 2

- [ ] Remove the start from the `bundle` case of `session.ts`. Keep the
      release of the context on failure.
- [ ] Move the session tests of prepared children to the product order.
- [ ] Run the two red tests and the sidecar tests green.

## Milestone 4: Records

Depends on: none

- [ ] Add the closed experiment record of the light sidecar entry.
- [ ] Add the open follow-up item for the stylesheet chain.
- [ ] Delete `plans/follow-ups/prepared-child-single-start.md`, which this
      change fixes.

## Milestone 5: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Prove equal published bytes on the four fixtures.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Send the final product SHA to the performance orchestrator for its
      warm-start check.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds and deletes.
