# Held Response Helper And Cancellation Checks

Status: Active. Planned on 2026-10-08. The user asked for this plan on
2026-10-08 to fix the two open findings from the review of
[PR #184](https://github.com/mokly-ai/mokly/pull/184). No PR is open yet.

Two browser-test findings from that review stay open. First, the two
pending-edit tests in `tests/browser/component_controls_runtime.spec.ts` end
with a check that cannot detect an obsolete response, because the page cancels
the held request before the test releases it. Second,
`tests/browser/comparison_renewal.spec.ts` and `tests/browser/review.spec.ts`
hold a fetched response in an inline route handler and hide every `fulfill`
error with `.catch(() => undefined)`. This plan adds one shared held-response
helper for browser tests, moves every inline copy of the pattern onto it, and
makes the two controls tests assert that the page cancels the obsolete request.
The change is test and documentation only. No product behaviour changes.
Evidence for every milestone lives under `.context/held-response-helper/`.

## Background

PR #184 fixed a flaky controls test. Its route handler fetched the light-scheme
render response, waited a real 250 ms, then called `route.fulfill`. When the
test ended first, `BrowserContext.close()` disposed the fetched body before the
late `fulfill`, which failed with "Fetch response has been disposed". The fix
holds the response on a promise, releases it after the assertion, and waits for
the handler with `page.unrouteAll({ behavior: "wait" })` before the test ends.
The evidence is under `.context/flaky-component-controls/`.

The review of that fix reported two Low findings, both `Auto-fix: no`:

1. Finding 1 (test). The last check in each pending-edit test repeats the
   check made before the release. The page aborts the held request when the
   context or the route changes, so the late response never reaches the page.
   The tests do not check the cancellation rule in the controls protocol.
   Recommended option A: assert that the held request fails with
   `net::ERR_ABORTED` and that the status shows the expected text.
2. Finding 2 (code structure). `comparison_renewal.spec.ts:46` and
   `review.spec.ts:138` hide `fulfill` errors with a catch-all. Recommended
   option C: one shared helper for held responses, in a separate change.

What the page does. `packages/viewer/src/shell/component_controls.tsx` keeps
one `AbortController` per render. Its `cancel()` aborts the active request
when the context key changes, when the scope changes on navigation, on reset,
and on unmount. Chromium reports the aborted fetch as a `requestfailed` event
with the failure text `net::ERR_ABORTED`. After a context change with a dirty
draft, the controls render the draft again in the new context, and the status
shows "Edited props". After navigation to another component, the scope
changes, the state resets, and the status shows "Saved props".

Why no catch-all is needed. Playwright ignores a `fulfill` for a request that
the page already cancelled; Chromium answers "Invalid InterceptionId" and
Playwright drops it. The only `fulfill` error seen so far is the teardown race
above. A release-then-wait order prevents it. A catch-all would hide that race
again, and it would hide every other `fulfill` error too.

Why a release in `finally` is wrong. When a check fails before the release,
the held handler never calls `fulfill`, so it cannot race teardown. A release
in `finally` makes the handler call `fulfill` while the test is ending, which
is the race that PR #184 removed.

## Contract Owners

- [CI test timing](../docs/protocol/ci-test-timing.md) owns the evidence
  methods for non-blocking behaviour and will own the held-response rule.
- [Component controls](../docs/protocol/mokly-component-controls.md) owns the
  rule "Cancel obsolete requests on navigation, reset, variant/context change,
  or disconnect" and the Verification list of browser-test coverage.
- [Review](../docs/dev/review.md) names "an explicit readiness signal" as a
  flaky-test method.
- [CI suite evidence](../docs/protocol/ci-suite-evidence.md) owns
  `MOKLY_PLAYWRIGHT_WORKERS`.

## Inventory

Held fetched responses in `tests/browser/`:

| File | Where | Held request | Catch-all | Wait before the test ends |
| --- | --- | --- | --- | --- |
| `component_controls_runtime.spec.ts` | navigation test, lines 211-224 | render POST | no | `unrouteAll` wait |
| `component_controls_runtime.spec.ts` | context test, lines 247-262 | light render POST | no | `unrouteAll` wait |
| `comparison_renewal.spec.ts` | `gate` and `holdRenewal`, lines 24-55, used by five tests | HEAD `review.json` | yes | `finished` promise; release in `finally` |
| `review.spec.ts` | one test, lines 131-139 | `review.json` | yes | none |
| `evidence_races.spec.ts` | three tests, lines 24, 78 and 131 | document or evidence GET | no | `unrouteAll` wait; release in `finally` |

Not affected: `same_origin_reconnect.spec.ts` and
`standalone_appearance_loading.spec.ts` hold a synthetic CSS response with no
fetched body, so the disposal race cannot happen there.
`viewer_namespace_versions.spec.ts`, `removed_previews_static.spec.ts` and
`scoped_shell_fixture.ts` fetch and fulfill at once without a hold.

## Decisions

1. Helper location. `tests/browser/held_response.ts`, beside the other
   Playwright helpers such as `workspace_actions.ts`. It is not under
   `tests/helpers/`, which unit tests share.
2. Helper contract. `holdResponse(page, url, match?)` registers one route. A
   request that `match` rejects continues at once. A matching request is
   fetched with `route.fetch()`, counted, reported through `arrived`, held
   until `release()`, then fulfilled with the fetched response. The handler
   never catches; a `fulfill` error fails the test. The result exposes
   `arrived: Promise<Request>` for the first held request, `release()`,
   `requests()` for the count of held requests, and `settle()`. `settle()`
   calls `release()`, waits until every started handler has finished, then
   removes the route. The helper adds no sleep, retry or clock.
3. Cleanup order in every converted test: release, settle, then the final
   checks. No `try/finally` release and no `.catch` on `fulfill`.
4. Convert `evidence_races.spec.ts` in the same change, so the helper is the
   only held-response pattern. Its "first request only" case uses a `match`
   closure that accepts one request. The user may exclude this file.
5. The controls protocol doc has exactly 250 lines, the protocol cap. The
   Verification edit in Milestone 1 must not add a line.
6. The cancellation check asserts the exact text `net::ERR_ABORTED`. A
   Playwright or Chromium update that changes the text fails the test loudly.
   No regular expression.
7. The status check uses the text each path produces: "Edited props" after the
   context change, "Saved props" after navigation.

## Milestone 1: Documentation and protocol

Define the held-response rule and name the cancellation coverage before the
test changes.

- [ ] Add a "Held Responses" section to
      [CI test timing](../docs/protocol/ci-test-timing.md). It states: hold a
      fetched response on a promise; signal arrival with a promise, not a
      clock; release after the assertion that needs the pending state; wait
      for every handler before the test ends; never hide `fulfill` errors
      with a catch-all; never release in `finally`. It names
      `tests/browser/held_response.ts` as the shared implementation. Keep the
      file under 250 lines.
- [ ] Edit the Verification paragraph in
      [component controls](../docs/protocol/mokly-component-controls.md) so
      the browser-test list names cancelled obsolete requests on navigation
      and context change. Keep the file at 250 lines or fewer.
- [ ] Run `grep -rn "ci-test-timing" tests/` and keep every structural test
      that reads the doc green.
- [ ] Run `cargo xtask check --suite repository`. Save the output under
      `.context/held-response-helper/`.
- [ ] Commit with Conventional Commits.

## Milestone 2: Shared helper and conversions

Add the helper and move the inline copies that hide errors onto it.

- [ ] Create `tests/browser/held_response.ts` with the contract in Decision 2.
      Give the module and each export a doc comment.
- [ ] Convert `comparison_renewal.spec.ts`: delete `gate` and `holdRenewal`;
      hold HEAD `review.json` requests through the helper; replace each
      `pending.finished` wait with `await pending.settle()`; remove the
      `.catch` and every `try/finally` release. Keep every assertion,
      including the `requests()` count.
- [ ] Convert the review test "pending requests cannot replace Current or a
      newly navigated screen": hold through the helper, remove the `.catch`,
      and call `await pending.settle()` after the release and before the
      final checks.
- [ ] Convert the three held tests in `evidence_races.spec.ts` (Decision 4):
      hold through the helper, settle in the test body, and keep only
      `fixture.close()` in `finally`.
- [ ] Run `npm run lint`.
- [ ] Repeat the converted specs with six workers:
      `MOKLY_PLAYWRIGHT_WORKERS=6 npm run test:browser -- tests/browser/comparison_renewal.spec.ts tests/browser/review.spec.ts tests/browser/evidence_races.spec.ts --repeat-each=50`.
      Require a 100% pass rate. Save the log under
      `.context/held-response-helper/`.
- [ ] Confirm every changed TypeScript file has at most 300 lines.
- [ ] Commit with Conventional Commits.

## Milestone 3: Cancellation checks in the controls tests

Make the two pending-edit tests prove the cancellation rule.

- [ ] Convert "component navigation discards a pending edit owned by the
      previous route" and "changing context while the first edit is pending
      cannot apply an obsolete preview" to the helper. The context test holds
      only the request whose `colorScheme` is `light`.
- [ ] In each test, take the held request from `arrived`. Register
      `page.waitForEvent("requestfailed", (request) => request === held)`
      before the trigger: the scheme change or the navigation click.
- [ ] After the existing checks that follow the trigger, assert that the
      failed request's `failure()?.errorText` is `net::ERR_ABORTED`.
- [ ] Call `await pending.settle()`. Keep the existing final check. Then assert
      that `[data-controls-status]` has the text "Edited props" in the
      context test and "Saved props" in the navigation test.
- [ ] Keep every existing assertion in both tests.
- [ ] Prove the new check has effect: disable the `cancel()` call that runs on
      a context change in `packages/viewer/src/shell/component_controls.tsx`
      locally, rebuild, run the context test once, and record the failure
      text under `.context/held-response-helper/`. Revert the product change.
      Do not commit it.
- [ ] Repeat the spec with six workers:
      `MOKLY_PLAYWRIGHT_WORKERS=6 npm run test:browser -- tests/browser/component_controls_runtime.spec.ts --repeat-each=100`.
      Require a 100% pass rate. Save the log.
- [ ] Confirm the spec has at most 300 lines. If it does not, move the two
      pending-edit tests to `tests/browser/component_controls_pending.spec.ts`
      and share the server setup through a fixture module.
- [ ] Commit with Conventional Commits.

## Milestone 4: Verification, push and review

- [ ] Run the complete `cargo xtask check`. Save the output under
      `.context/held-response-helper/`.
- [ ] Inspect `git diff --name-status origin/main` and
      `git diff --diff-filter=D --name-status origin/main`. Expect no deleted
      files.
- [ ] Run `git add -A`, commit with Conventional Commits, and push.
- [ ] Open a PR into `main` with the title
      `test(browser): share held responses and assert cancellation`. Record
      the plan in the description.
- [ ] Review: after the push, use `docs/implementation-review-prompt.md` to
      review the complete local diff against `origin/main`. Report the
      findings. Apply the review-fix rule in `docs/dev/review.md`: fix the
      `Auto-fix: yes` findings, run the checks, commit, push, re-run the
      review once, and report the rest. Add each open finding as one line
      below.

## Post-merge follow-up (non-blocking)

- [ ] Watch the first five Required CI runs on `main` after the merge. Report
      any failure in the converted specs with its `requestfailed` text.
