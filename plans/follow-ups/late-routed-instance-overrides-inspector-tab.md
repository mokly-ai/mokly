# A late routed instance overrides the reader's tab

- **Severity:** Medium. **Likelihood:** Common. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-20, from PR #378 on the branch
  `calummoore/fu-flaky-workspace-evidence-host-url-u9kr`. The user asked to
  record it before that pull request merges.
- **Location:** `packages/viewer/src/shell/workspace_instance_selection.ts:55-63`,
  the effect that opens Props when the routed instance first resolves, and
  lines 39-41 of that file, which resolve the instance.
  `packages/viewer/src/shell/workspace_usage.tsx:23-35`, which puts the
  instance key in each usage link.
  `packages/viewer/src/shell/inspector.tsx:125` and
  `packages/viewer/src/shell/store_actions.ts:145-152`, which carry a tab
  click to the store's open tab. `packages/ui/src/inspector/inspector.tsx:216`,
  which hides each panel except the open tab's.
  `docs/protocol/mokly-component-explorer.md:154-155`, the Used by rule.
- **Reason:** PR #378 fixes only the test's wait, and a change to which tab
  wins changes a requirement that the user must choose.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Inspector:** the tab strip below the preview in the Browse shell, with
    Details, Props, Usage, and, on a screen, Components. Only the open tab's
    panel is visible.
  - **Usage link:** a Used by or Affected link in the Usage panel of a
    component page. It opens a screen or a component that uses the component.
  - **Routed instance:** the component instance that the `instance` query of
    a viewer address names. Each usage link adds this query.
  - **Entry detail:** the JSON file of one entry, such as
    `/mokly-viewer/entries/screens/changed.json`, which the shell loads after
    a navigation. It holds the component usage of each view, with the
    instance keys.
  - **Client navigation:** a route change inside the loaded shell document,
    without a full page load.
- **Background:**
  - Mokly builds static mockup catalogues and shows them in the Browse shell.
    The Usage panel of a component page lists its Used by links. A changed
    component also lists Affected links.
  - `usageHref` builds each usage link with the recorded viewport, scheme,
    and instance key. It adds `comparison=side` to an Affected link whose
    view can be compared.
  - `docs/protocol/mokly-component-explorer.md:154-155` says that a Used by
    link opens the owning screen and opens its selected instance in Props.
    The shell selects the routed instance of an Affected link in the same
    way.
  - The contract does not say which tab wins when the reader opens a tab
    before the entry detail arrives. Its tab rule at
    `docs/protocol/mokly-component-explorer.md:91-96` says only that a click
    opens or switches a panel.
  - The instance keys arrive only with the entry detail. In the local trace
    below, the destination's heading showed before its entry detail request
    started.
  - The inspector keeps its open tab across a client navigation. In the local
    trace below, the source page's Usage tab stayed open on the destination.
  - The effect at `workspace_instance_selection.ts:55-63` calls
    `store.setDetails(true, "props")` the first time that the routed instance
    resolves. Its `openedInstance` ref records only which instance it opened.
    It does not record a tab that the reader chose since the navigation.
  - A reader's tab click calls the same `store.setDetails`. The store keeps
    one open tab, so the last call wins.
  - The browser test
    `a destination's evidence opens at host URL form extensionless` in
    `tests/browser/static_workspace_evidence.spec.ts` opens the Card component
    page, opens Usage, and follows the Affected link "Changed screen". Before
    PR #378, it then waited for the heading, clicked Details, and expected the
    evidence line "Changed component: Card" to be visible.
  - PR #378 makes the test wait for the selected Props tab before it clicks
    Details, at `tests/browser/static_workspace_evidence.spec.ts:93-96`. The
    wait makes the test deterministic. It does not decide what a reader's
    early click should do.
  - The local trace of one failed run of the unchanged test follows. Each time
    is in milliseconds on the monotonic clock of its trace. The route was
    `/view/screens/changed/?viewport=mobile&scheme=light&instance=04d18a64e115b0260147c48d798a705df2b16127a80ffc765bced9f28e09ad0f&comparison=side`.
    1. 49196.513: the link click starts. At 49222.476, the inspector is open,
       and Usage is selected.
    2. 49228.737: the heading assertion passes.
    3. 49259.455: the request for `/mokly-viewer/entries/screens/changed.json`
       starts.
    4. 49264.649: the Details click completes. At 49266.256, Details has
       `aria-selected="true"`, and its panel is visible.
    5. 49267.852: the visibility assertion starts. At 49268.847, Details is
       still selected.
    6. 49305.393: the detail request completes with HTTP 200. In the
       response, the usage of all four views holds the recorded Card instance
       key.
    7. 59268.470: the assertion ends at its 10-second limit. At 59271.811, the
       inspector is open, and Props is selected. Details is not selected, and
       its panel has the `hidden` attribute.
    8. No tab click occurs after the Details click.
  - The failure text of that run:

    ```text
    Error: expect(locator).toBeVisible() failed
    Locator: locator('[data-workspace-evidence]').getByText('Changed component: Card', { exact: true })
    Expected: visible
    Received: hidden
    Timeout: 10000ms
    ```

  - During the wait, the locator resolved to the evidence paragraph 24 times,
    and the paragraph stayed hidden.
  - Of 100 isolated runs of the unchanged test, 99 passed, 1 failed, and none
    was skipped. A first batch stopped at its first failure after 2 runs, and
    a second batch ran the other 98. These runs show that the order occurs.
    They do not estimate how often a reader meets it.
  - CI run 44596520325, attempt 1, failed in the same test on commit
    `e060d5b89e9c4cb7e84faf3a7e2d265231476fe5` of PR #350, in the job
    `Browser (Node 22.15.0, shard 4/4)`. Its trace shows the same order:
    1. 445223.561: the link click. At 445256.579, the heading assertion
       passes.
    2. 445280.673: Details is selected after its click. At 445283.209, the
       visibility assertion starts, and Details is still selected.
    3. 445359.547: the destination detail request starts. It ends at about
       445480.519 with HTTP 200.
    4. 455289.288: Details is not selected, and Props is selected.
  - In the two traces, the entry detail arrived about 109 ms and about 257 ms
    after the link click. Only a tab action inside that time meets the
    problem. Nobody measured that time on a hosted catalogue or a slow
    network.
  - Likelihood is Common because a reader can choose a tab during a normal
    detail load. The traces do not measure real-user frequency.
  - Both traces show that the shell accepts a real Details click, and that the
    late Props selection then replaces it. They do not show which tab the
    product should keep.
  - Two existing test helpers can hold a detail request open. `FakeDataSource`
    in `packages/viewer/tests/data_fakes.ts:59-62` answers each detail request
    only when the test does. `holdDetail` in
    `tests/browser/shell_props_delivery.spec.ts:18-27` holds the first request
    of one detail file.
  - `tests/browser/component_explorer_navigation.spec.ts:10-49` checks that a
    Used by link opens Props with the instance. Like the PR #378 wait, it
    waits for Props before it clicks Details. So neither test covers this
    order, and each option below keeps both tests valid.
- **Problem:** When the entry detail arrives after the reader chose an
  inspector tab, the routed instance opens Props over that choice. The panel
  that the reader opened is hidden. This is a possible product bug, because no
  requirement says which tab should win.
- **Impact if no action:** A reader who opens a tab soon after a usage link
  can see Props replace it, and must open the tab again. The precedence stays
  unstated, so a later change or test cannot tell whether the override is
  intended.
- **Root question:** When a reader acts on the inspector before a usage
  link's instance resolves, which tab should the inspector show?
- **Options:**
  - **A.** Keep today's behaviour, and state it in the contract.
    - The routed instance opens Props when its entry detail arrives, also over
      a tab that the reader chose since the navigation.
    - Add this precedence next to the Used by rule at
      `docs/protocol/mokly-component-explorer.md:154-155`. Name both kinds of
      usage link.
    - The product code does not change.
    - Test: hold the destination detail, click Details, release the detail,
      and expect Props.
    - Cost: the reader's explicit choice still loses to a background event,
      and the contract then requires that.
    - Effort: Small.
  - **B.** Keep a tab that the reader chose after the navigation.
    - The routed instance still becomes the selected instance when its entry
      detail arrives.
    - It opens Props only when the reader has not acted on the inspector since
      the navigation. A tab click, Close, and Escape each count as an action.
    - In one design, the store records a pending Props opening for each route
      that names an instance, also on a full page load. It sets the record
      where it sets `comparisonIntent`: `packages/viewer/src/shell/store_initial.ts:57`,
      `packages/viewer/src/shell/store.tsx:218`, and
      `packages/viewer/src/shell/store_routes.ts:28`. The first instance
      resolution or the first reader action settles the record.
    - `packages/viewer/src/shell/comparison_intent.ts:28-51` settles the
      comparison query of a navigation in the same way.
    - Add the precedence next to the Used by rule, for both kinds of usage
      link.
    - Test: use the same order, and expect Details. Add a second case with no
      reader action, and expect Props.
    - Cost: the late tab change stays, behind a condition. Each later
      automatic tab change must honour the same record. Without a reader
      action, the tab still changes to Props when the detail arrives.
    - Effort: Medium.
  - **C.** Open Props with the navigation, and let the detail only fill it.
    - When a route that names an instance opens, also on a full page load,
      the shell opens the inspector at Props at once. It does this at the
      three places where B sets its record.
    - Props shows the existing text `Waiting for the component preview.` or
      `Loading props…` until the entry detail arrives. The texts come from
      `packages/viewer/src/shell/workspace_props.tsx:70-79` and lines 110-125
      of that file.
    - The arrival then only resolves the instance and fills Props. Remove the
      effect at `workspace_instance_selection.ts:55-63` and the
      `openedInstance` ref, which only that effect reads.
    - A tab that the reader chooses later stays open, because no arrival
      changes the tab.
    - When the key does not resolve, Props stays open with no selected
      instance. It then shows the prompt
      `Select a component instance to see its supplied props.` or the entry's
      own props. Today the tab does not change in that case.
    - Change the Used by rule at
      `docs/protocol/mokly-component-explorer.md:154-155`. It then says that
      Props opens with the navigation and shows the instance when it
      resolves. Name both kinds of usage link.
    - Test: hold the detail, navigate, and expect Props before any reader
      action. Click Details, and expect Details before and after the detail
      release.
    - Cost: Props opens before its content, and a stale key leaves Props open
      without an instance.
    - Effort: Medium.
- **Shared assumptions:**
  - Without a reader action, a usage link that names an instance ends with
    that instance in Props. Source: the Used by rule at
    `docs/protocol/mokly-component-explorer.md:154-155`, and the code for
    Affected links. Its reason holds, because the link names one instance.
    Every option keeps it.
  - The reader can use the inspector while the entry detail loads. Source:
    the code, and the tab rule at
    `docs/protocol/mokly-component-explorer.md:91-96`. Every option keeps it.
    **Left out** gives the approach that drops it.
- **Left out:**
  - Change nothing. The precedence then stays unstated, so it fails the goal.
    A states the same behaviour with one sentence.
  - Select the instance on arrival, but never open Props. It drops the Used
    by rule, whose reason still holds.
  - Disable the inspector tabs until the instance resolves. It breaks the tab
    rule, which lets a reader open any panel. It also adds a state that no
    mockup shows.
  - Load the entry detail earlier, such as when the pointer rests on the link.
    It shortens the wait but does not remove it. A slow load still loses the
    reader's choice, so it fails the goal.
  - A sleep, a retry, a repeated run, or a longer time limit in the
    regression test. Each hides the order instead of checking it. No test
    checks the words of the contract.
- **Wider fix:** C. It removes the late tab change, so no later detail can
  replace a reader's choice, and no condition needs upkeep. B adds a condition
  at one call site. If the user chooses A, the override is intended, so no
  wider fix applies.
- **Previous examples:**
  - PR #377 merged on 2026-11-20 as commit `525b4d7e`. In the cloud Expo app,
    an older session read could answer after a newer one and replace it.
    Account settings could then show GitHub as not connected after the
    connection succeeded.
  - PR #377 added one session read owner in
    `packages/app/src/session/read-owner.ts`. It applies only the newest answer,
    through the request sequence in `packages/app/src/data/request-sequence.ts`.
    A sign-in adoption or a sign-out discards pending reads.
    `docs/protocol/cloud/web-api-client.md` states the rule.
  - That case and this item share a class: a late answer replaces newer
    state. They share no code and no cause.
  - In the viewer, `packages/viewer/src/shell/comparison_intent.ts:28-51`
    applies the comparison query of a navigation once, when the view's
    eligibility is first known. `docs/protocol/mokly-changes-controls.md:55`
    says that navigation must never let a late comparison response replace
    another screen. No such rule covers the inspector tab.
- **Recommendation:** C. It keeps the reader's later choice, because no detail
  arrival changes the tab, so nothing needs a condition.
- **Action:** ask the user, because each option adds a tab precedence that no
  requirement states, and no recorded user decision chooses one.

History: [PR #378](https://github.com/mokly-ai/mokly/pull/378), and
[CI run 44596520325](https://github.com/mokly-ai/mokly/actions/runs/44596520325)
of PR #350.
