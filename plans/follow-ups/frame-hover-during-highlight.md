# Hover during a highlight differs by adapter

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-03, from the options check of the frame package plan on the branch `calummoore/viewer-inspector-purpose`.
- **Location:** `packages/viewer/src/inspector/runtime.ts:57`, `packages/viewer/src/client/same_origin_pointer.ts:22`, and `docs/protocol/mokly-viewer-selection.md:91-94`.
- **Reason:** Each fix adds a rule that no protocol doc states, so the user must choose the rule first.

- **Terms:**
  - **Highlight:** the viewer mode that masks and labels chosen component
    instances in a preview frame. A host starts it with `highlightInstance`
    or `highlightInstances`.
  - **Pick:** the viewer mode in which the user chooses one instance. A host
    starts it with `startPick`.
  - **Same-origin adapter:** `sameOriginAdapter` in
    `packages/viewer/src/client`. It reads a local frame directly, with page
    scripts off.
  - **In-frame inspector:** the script `inspector.js`, built from
    `packages/viewer/src/inspector`. It runs inside a cross-origin frame and
    talks to `postMessageAdapter`.
- **Background:**
  - The viewer passes each hover event of a frame to the public
    `onInstanceHover` callback, in
    `packages/viewer/src/viewer/host_bridge_events.ts:69`.
  - During a highlight or a pick, the in-frame inspector reports hover only
    for the highlighted or pickable keys. The filter
    `(!active || keys.includes(key))` at `runtime.ts:57` applies to hover
    and to click.
  - The same-origin adapter reports hover for every instance in every mode.
    `same_origin_pointer.ts:22` reads the full boundary list, which
    `packages/viewer/src/client/same_origin_adapter.ts:48` supplies.
  - Both adapters limit clicks to the highlighted or pickable keys while a
    highlight or a pick is active.
  - `docs/protocol/mokly-viewer-selection.md:91-94` says: "Every current,
    visible frame with ready usage can emit authenticated hover and click
    events, independent of an explicit highlight's mask and label scope;
    such a click leaves an idle highlight intact and ends inspection only
    while a pick is active." It does not say clearly whether this covers
    the instances inside a highlighted frame.
  - No test covers hover during a highlight or a pick.
- **Problem:** A host gets different hover events from the same page,
  because the two adapters use different rules. The protocol does not say
  which rule is right.
- **Impact if no action:** A host with same-origin frames and a host with
  cross-origin frames, such as Mokly Cloud, show different hover feedback
  during a highlight or a pick.
- **Root question:** Which instances should hover report while a highlight
  or a pick is active?
- **Options:**
  - **A.** Every instance, in every mode. Change the in-frame inspector.
    During a pick, hover then also reports instances that the user cannot
    pick. Effort: Small.
  - **B.** Only the highlighted or pickable keys while a highlight or a pick
    is active. Change the same-origin adapter. Hover then reports the same
    instances as a click. Effort: Small.
  - **C.** Every instance during an idle highlight, and only the pickable
    keys during a pick. Change both adapters. This follows the protocol
    sentence for idle highlights. Clicks during an idle highlight stay
    limited to the keys, so hover and click then differ. Effort: Small.
- **Left out:** Keep the difference and document it. It fails the goal,
  because a host must then know which adapter the viewer uses.
- **Wider fix:** None that this item can apply. One event runtime for both
  adapters would remove this class of difference. That is a Large change,
  and the user has not chosen it yet.
- **Previous examples:** None found.
- **Recommendation:** B. Hover then reports the same instances as a click in
  both adapters, and the change stays in one adapter. Add one sentence to
  `docs/protocol/mokly-viewer-selection.md` that states the rule.
- **Action:** ask the user, because the protocol doc does not say which
  instances hover reports inside a highlighted frame, so each option adds a
  rule.
