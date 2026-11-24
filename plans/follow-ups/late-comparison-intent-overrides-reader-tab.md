# A late comparison intent overrides the reader's tab

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-20, from PR #378 on the branch
  `calummoore/fu-flaky-workspace-evidence-host-url-u9kr`. The user asked to
  record it before that pull request merges. Rewritten on 2026-11-23 on the
  branch `calummoore/canvas-redesign-m12-right-panel-and-fo8u`, because the
  Canvas viewer removed the tabbed inspector and its late Props opening.
- **Location:** `packages/viewer/src/shell/comparison_intent.ts:37-55`, the
  effect that selects Changes once the eligibility is known, and lines 16-26
  of that file, which wait for the route's details.
  `packages/viewer/src/shell/right_panel.tsx:62` and
  `packages/viewer/src/shell/store_actions.ts:170-174`, which carry a
  reader's tab pick to the store.
  `packages/viewer/src/shell/workspace_usage.tsx:33-34`, which adds the
  intent to a usage link. `docs/protocol/mokly-component-inspector-design.md:25-32`,
  the tab rule.
- **Reason:** The tab rule does not say which tab wins over a pick that the
  reader makes before the details arrive, so a fix adds a requirement that the
  user must choose.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Comparison intent:** the `comparison=side` query of a viewer address.
    The store holds it once for each route installation, as
    `comparisonIntent`.
  - **Usage link:** a link in the Usage section of a component, in Inspect.
    An Affected link opens a consumer that the component's change affects.
  - **Right panel:** the panel beside the canvas, with the tab Inspect and,
    where the entry has it, the tab Changes. The store holds the selected tab
    as `panelTab`.
  - **Standalone shell:** the Browse shell that Serve and the static build
    deliver, not a React host of `MoklyViewer`.
- **Background:**
  - Mokly builds static mockup catalogues and shows them in the Browse shell.
    A changed component's Usage section lists Affected links.
  - `usageHref` adds `comparison=side` to an Affected link, or to the link of
    a removed consumer, when the consumer can be compared, at
    `workspace_usage.tsx:33-34`. No other link of the shell adds it.
  - The store sets the intent for each route installation, at
    `packages/viewer/src/shell/store_initial.ts:54` and
    `packages/viewer/src/shell/store_routes.ts:34`. An embedded host's route
    carries none, as `packages/viewer/tests/comparison_intent.test.ts:148-158`
    checks. So only the standalone shell applies it.
  - `useComparisonIntent`, at `comparison_intent.ts:37-55`, waits until the
    destination's eligibility is known. `comparisonEligibilityKnown`, at lines
    16-26, needs a complete index classification and route details that
    arrived or failed.
  - The effect then settles the intent. For an eligible view, it opens Side by
    side and calls `setPanelTab("changes")`.
  - A reader picks a tab through the same `store.setPanelTab`, at
    `right_panel.tsx:62`. The store keeps one tab, so the last call wins. The
    effect does not check whether the reader picked a tab since the
    navigation.
  - The tab strip shows while the details load, and the stage shows
    "Loading preview…". A destination that the Changes filter lists has its
    Changes tab at once. An affected-only destination gets it only when its
    details arrive.
  - The tab rule at `docs/protocol/mokly-component-inspector-design.md:25-32`
    says that in-shell navigation selects Changes when the destination
    honours a comparison intent. Its decision: an honoured intent selects
    Changes, not Inspect or the kept tab, because the link exists to show the
    comparison. The rule does not say which tab wins over a pick that the
    reader makes before the details arrive.
  - Not reproduced. No test or trace shows a reader's pick that the late
    selection replaced. The unit test at `comparison_intent.test.ts:111-146`
    checks the tab after an honoured intent, with no reader's pick.
  - On 2026-11-20, two traces of an Affected link in the static build, for
    PR #378, showed the destination's details about 109 ms and 257 ms after
    the click. Nobody measured that time on a slow network or a busy Serve.
  - Confidence is Medium, because a read of `comparison_intent.ts:37-55` shows
    the missing check, but nobody ran the order.
  - Likelihood is Rare. A usage link is in Inspect, so the reader starts on
    Inspect. The late selection replaces a pick only when the reader picks
    Changes and then Inspect inside one detail load.
  - Two test helpers can hold a detail request: `FakeDataSource` in
    `packages/viewer/tests/data_fakes.ts:60` answers each detail request only
    when the test does, and `holdDetail` in
    `tests/browser/shell_props_delivery.spec.ts:28-37` holds the first read of
    one detail file.
- **Problem:** When a reader picks a tab after a usage link and before the
  destination's details arrive, the honoured intent then selects Changes over
  that pick. This is a possible product bug, because no requirement says
  which tab should win.
- **Impact if no action:** A reader who picks Inspect during the load sees
  Changes replace it, and must pick Inspect again. The precedence stays
  unstated, so a later change or test cannot tell whether the override is
  intended.
- **Root question:** When a reader picks a tab before a usage link's
  comparison intent settles, which tab should the right panel show?
- **Options:**
  - **A.** Keep today's behaviour, and state it in the contract.
    - The honoured intent selects Changes when the destination's details
      arrive, also over a tab that the reader picked since the navigation.
    - Add this precedence to the tab rule in
      `docs/protocol/mokly-component-inspector-design.md:25-32`.
    - The product code does not change.
    - Test: hold the destination's details, pick Changes and then Inspect,
      release the details, and expect Changes.
    - Cost: the reader's explicit pick still loses to a background event, and
      the contract then requires that.
    - Effort: Small.
  - **B.** Keep a tab that the reader picked since the navigation.
    - The store records a reader's tab pick for each route installation, where
      it sets `comparisonIntent`.
    - The honoured intent still opens Side by side. It selects Changes only
      when the reader picked no tab since the navigation.
    - Add the precedence to the tab rule.
    - Test: use the same order, and expect Inspect. Add a case with no pick,
      and expect Changes.
    - Cost: one more record, which each later automatic tab change must
      honour.
    - Effort: Medium.
  - **C.** Let a reader's tab pick settle the intent.
    - A pick before the eligibility is known calls `settleComparisonIntent`.
      The intent then neither opens Side by side nor selects Changes.
    - Add the precedence to the tab rule.
    - Test: use the same order, and expect Inspect and Current.
    - Cost: a reader who then opens Changes finds Current, not the comparison
      that the link asked for.
    - Effort: Small.
- **Shared assumptions:**
  - Without a reader's pick, an honoured intent ends with Side by side on the
    Changes tab. Source: the decision of the tab rule at
    `docs/protocol/mokly-component-inspector-design.md:30-32`. Every option
    keeps it.
  - The reader can pick a tab while the details load. Source: the code at
    `right_panel.tsx:62`, and the tab rule. Every option keeps it.
- **Left out:**
  - Change nothing. The precedence then stays unstated, so it fails the goal.
    A states the same behaviour with one sentence.
  - Disable the tab strip until the intent settles. It breaks the tab rule,
    which lets a reader pick any tab. It also adds a state that no mockup
    shows.
  - Select Changes with the navigation, before the details arrive. An
    affected-only destination has no Changes tab until its details arrive,
    and an ineligible destination then drops the tab late, which is the same
    late change.
  - Load the details earlier. It shortens the wait but does not remove it.
  - A sleep, a retry, a repeated run, or a longer time limit in the
    regression test. Each hides the order instead of checking it.
- **Wider fix:** B. One record of the reader's pick, which each automatic tab
  change honours, stops every later automatic change from replacing it.
- **Previous examples:**
  - Before the Canvas viewer, the routed instance of a usage link opened the
    Props tab when its details arrived, also over a tab that the reader
    picked. PR #378 recorded that case in this item on 2026-11-20, with a
    failed trace. Commit `9d2c7925e` removed that effect with the tabbed
    inspector.
  - PR #377 merged on 2026-11-20 as commit `525b4d7e`. In the cloud Expo app,
    an older session read could answer after a newer one and replace it. It
    added one session read owner in `packages/app/src/session/read-owner.ts`,
    which applies only the newest answer through
    `packages/app/src/data/request-sequence.ts`. That case and this item share
    a class, a late answer that replaces newer state, but no code.
  - `docs/protocol/mokly-changes-controls.md:69` says that navigation must
    never let a late comparison response replace another screen. No such rule
    covers the panel tab.
- **Recommendation:** B. It keeps the reader's newest pick, and the
  comparison that the link asked for is still ready on Changes.
- **Action:** ask the user, because each option adds a tab precedence that the
  tab rule does not state, and no recorded user decision chooses one.

History: [PR #378](https://github.com/mokly-ai/mokly/pull/378),
[CI run 44596520325](https://github.com/mokly-ai/mokly/actions/runs/44596520325)
of PR #350, and
[this item before the Canvas viewer](https://github.com/mokly-ai/mokly/blob/98fdf3ee65bd1201bd0a0990af8e078e328c7e55/plans/follow-ups/late-routed-instance-overrides-inspector-tab.md?plain=1).
