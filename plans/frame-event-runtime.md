# Frame event runtime

Status: Active. On branch `calummoore/viewer-inspector-purpose`, no pull
request yet. The pull request that completes the work deletes this plan, as
the `plans` skill says.

The viewer inspects preview frames in two ways. `sameOriginAdapter` reads a
local frame directly, with page scripts off. `postMessageAdapter` talks to
the frame probe, a script inside a cross-origin page. Both already share
the boundary listing, the box geometry, the clipping rules, and the marker
pattern. Each has its own event runtime for hover, pick, Escape, link
clicks, and layout changes. The same-origin pick also has a second geometry
path, `rangeBounds`, and a second marker walker. The two runtimes already
differ: during a highlight or a pick, the frame probe reports hover only for
the highlighted keys, and the same-origin adapter reports hover for every
instance. This change makes both adapters run one event runtime. It keeps
both transports and the script-disabled sandbox of local frames.

This plan starts after [the frame package plan](./frame-package.md)
completes, because it changes code that that plan moves into
`@mokly/frame` and renames to the frame probe. The paths below use the
names after that plan.

Decision 1, 2026-11-03, by the user: share one event runtime between both
adapters. The alternatives were A, change nothing, C, always use
`postMessageAdapter` with a second real origin, D, always use
`postMessageAdapter` with an opaque-origin sandbox, E, share only the pick
path, and F, find drift with a browser spec. Reason: one runtime removes the
drift, and the two runtimes already differ on hover.

Contract owners:

- The [viewer frame adapter](../docs/protocol/mokly-frame-adapter.md).
- The [viewer selection contract](../docs/protocol/mokly-viewer-selection.md).
- The frame probe contract, which the frame package plan renames from the
  [published inspector](../docs/protocol/mokly-published-inspector.md).

Replaced ways:

- The same-origin event code → the shared event core. The old way is
  `same_origin_pointer.ts`, `same_origin_highlight.ts`, `rangeBounds` and
  `authenticateRanges` in `component_geometry.ts`, `document_ranges.ts`,
  `component_range_nodes.ts`, and `component_occlusion.ts`. Consumers:
  `same_origin_mount.ts`, `same_origin_adapter.ts`, the unit tests of these
  modules, and `tests/browser/frame_clipping.spec.ts`. Moved and deleted in
  Milestone 3.

## Decisions

### 6. Hover during a highlight differs by adapter

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small.
- **Source:** Review.
- **Category:** Product bug.
- **Location:** `packages/viewer/src/inspector/runtime.ts:57`,
  `packages/viewer/src/client/same_origin_pointer.ts:22`, and
  `docs/protocol/mokly-viewer-selection.md:91-94`.
- **Terms:**
  - **Highlight:** the viewer mode that masks and labels chosen component
    instances in a preview frame. A host starts it with `highlightInstance`
    or `highlightInstances`.
  - **Pick:** the viewer mode in which the user chooses one instance. A host
    starts it with `startPick`.
- **Background:**
  - The viewer passes each hover event of a frame to the public
    `onInstanceHover` callback, in
    `packages/viewer/src/viewer/host_bridge_events.ts:69`. No product host
    passes this callback today. Mokly Cloud passes no instance callback,
    and the standalone shell passes none. Only two test hosts use it.
  - During a highlight or a pick, the frame probe reports hover only for the
    highlighted or pickable keys. The filter
    `(!active || keys.includes(key))` at `runtime.ts:57` applies to hover
    and to click.
  - The same-origin adapter reports hover for every instance in every mode,
    from the full boundary list.
  - Both adapters limit clicks to the highlighted or pickable keys while a
    highlight or a pick is active, and cancel the default action of those
    clicks.
  - When instances nest, the frame probe names the first key in digest
    order, so a pointer on a Button inside a Card can name either one. The
    same-origin pick names the innermost instance.
  - `docs/protocol/mokly-viewer-selection.md:91-94` says that every
    current, visible frame with ready usage can emit hover and click
    events, independent of an explicit highlight's mask and label scope.
    The sentence came with the rule for unavailable sibling frames, so it
    is about frames, not instances. No test covers hover during a highlight
    or a pick.
- **Problem:** A host gets different hover events from the same page,
  because the two adapters use different rules. The protocol does not say
  which rule is right. The shared runtime must use one rule.
- **Impact if no action:** Milestone 2 cannot choose the hover rule of the
  shared runtime.
- **Root question:** Should hover name the instance that a click at the same
  point would report, or the instance under the pointer?
- **Options:**
  - **A.** Every instance, in every mode. During a pick, hover then also
    reports instances that the user cannot pick. Effort: Small.
  - **B.** Only the highlighted or pickable keys while a highlight or a pick
    is active. Hover then reports the same instances as a click. Effort:
    Small.
  - **C.** Every instance during an idle highlight, and only the pickable
    keys during a pick. Clicks during an idle highlight stay limited to the
    keys, so hover and click then differ. Effort: Small.
  - **D.** An idle highlight is only a drawing. During an idle highlight,
    hover and click report every instance, and the frame cancels no link.
    Only a pick limits hover and click to the pickable keys. The click rule
    of the adapter contract changes, and a host can no longer use an idle
    highlight as a set of click targets. Effort: Medium.
  - **E.** Remove hover: the `hover` frame event, its wire message, and
    `onInstanceHover`. The shared runtime then needs no hover rule, and the
    frame probe gets bytes back. It deletes a documented public callback,
    so it needs your approval. A later host that wants hover must add it
    again. Effort: Medium.
  - **F.** B, and the hit test names the innermost instance under the
    pointer, for hover and for click. Hover then names exactly the instance
    that a click would report, also for nested instances. The frame probe
    changes from digest order to the innermost instance. Effort: Small.
- **Left out:** Keep the difference. It fails the goal of one runtime. A
  host option for the rule adds public API that no host uses.
- **Wider fix:** None that this decision can apply. The shared runtime of
  this plan is the wider fix for the class.
- **Previous examples:** None found.
- **Related:** Decision 1 chose the shared runtime, which needs this rule.
  The shared same-origin pick of the **Design** section needs the nesting
  rule of F, or a nested local pick can select the outer instance.
- **Recommendation:** F. The first recommendation was B. The frame probe
  already uses the B rule, so F adds only the nesting rule, which the shared
  runtime needs anyway. State the rule in
  `docs/protocol/mokly-viewer-selection.md` and
  `docs/protocol/mokly-frame-adapter.md`.
- **Action:** ask the user, because the protocol doc does not say which
  instances hover reports inside a highlighted frame, so each option adds a
  rule.

## Design

These are design calls of the planning agent, made on 2026-11-03.

- The runtime splits into a transport-free core and a wire wrapper. The core
  has direct methods for list, highlight, scroll-to, subscribe, and dispose,
  and it reports events through a callback. The frame probe entry wraps the
  core with the wire messages. The same-origin adapter calls the core
  directly on the frame window.
- The core takes the link classifier as a parameter. The frame probe passes
  the classifier of its inert link map. The same-origin adapter passes the
  `data-mokly-link` classifier of `same_origin_navigation.ts`, because
  served pages stay byte-unmodified and have no link map.
- The core takes its observer and timer constructors as a parameter. A
  script-disabled frame may not run callbacks of its own realm, so the
  same-origin adapter passes the viewer window.
- The same-origin pick hit-tests the boundary list of the shared reader,
  with the nesting rule of decision 6. `visibleFrameBox` stays in the
  viewer.
- The frame probe stays within its 9,216-byte budget. It has 955 bytes left
  on 2026-11-03. If the core does not fit, stop and ask the user, because
  a larger budget changes a protocol requirement.

## Milestone 1: Documentation and protocol

Depends on: none. It waits for decision 6 and for the frame package plan.

- [ ] State the hover rule of decision 6 in
      `docs/protocol/mokly-viewer-selection.md`.
- [ ] Update `docs/protocol/mokly-frame-adapter.md`: both built-in adapters
      run one event runtime, and every adapter follows the hover rule of
      decision 6.
- [ ] Update the README of `@mokly/frame`.

## Milestone 2: Transport-free event core

Depends on: 1.

The frame probe runs on the new core with the same wire behaviour.

- [ ] Split `probeRuntime` into the core and the wire wrapper of the
      **Design** section.
- [ ] Apply the hover rule of decision 6 in the core.
- [ ] Keep the frame probe within its budget. Run its budget test.

## Milestone 3: Same-origin adapter on the core

Depends on: 2.

The same-origin adapter uses the core, and the duplicated code goes.

- [ ] Run the core from `same_origin_mount.ts` and `same_origin_adapter.ts`
      with the link classifier and the viewer window.
- [ ] Move the tests of the old same-origin event code to the core, with
      every assertion. Move `tests/browser/frame_clipping.spec.ts` from
      `rangeBounds` to the shared reader.
- [ ] Delete the old way of the **Replaced ways** list. Record the searches
      that prove each part unused.
- [ ] Add a browser test for hover during a highlight and a pick on both
      adapters. Run it 10 times.

## Milestone 4: Verification, commit, review, and pull request

Depends on: every other milestone.

- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Smoke-test local Browse through `npm run dev`: hover, pick, Escape,
      and catalogue links in a screen and a component page.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record follow-up
      items under `plans/follow-ups/` for the rest, re-review once, and
      report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.
