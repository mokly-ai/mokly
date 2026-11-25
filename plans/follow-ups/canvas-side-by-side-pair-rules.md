# Each Side by side frame needs a hide rule

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the branch
  `calummoore/storybook-milestone-1a-canvas-mockups-omnr`, review round 1,
  finding 1. It is the wider fix B, which the branch split off its direct
  fix.
- **Location:**
  - `examples/basic/specs/design/canvas/parts/stage.tsx:186`, where
    `CanvasStage` sets `data-cv-chosen`, and `:242-286`, the `StageFrame`
    slot of each frame.
  - `examples/basic/design-canvas-components.css:93-100` and
    `examples/basic/design-canvas-changes.css:150-159`, the wide hide rules,
    one for each chosen frame name.
  - `examples/basic/specs/design/library/canvas/canvas-frame.view.tsx:100-113`,
    which writes the frame name to `data-cv-frame`.
  - The compact picker rules: `examples/basic/design-canvas-compact.css:115-132`
    and `:160-193`, and `examples/basic/design-canvas-components.css:167-188`
    and `:284-298`.
  - `examples/basic/design-canvas-shell.css:133`, the wide container query.
  - `tests/browser/component_design_cases.ts`, the regression case of the
    direct fix.
- **Reason:** B replaces the selection rules of comparisons across the Canvas
  family, outside the Storybook mockups that the branch draws.

- **Source:** Review.
- **Category:** Mockup.
- **Terms:**
  - **Side by side:** the compare mode that draws the Before and Current
    versions of one chosen frame, each in its own frame, next to each other.
  - **Pair:** the Before frame and the Current frame of one frame in Side by
    side. Both frames carry the same frame name.
  - **Frame name:** the `data-cv-frame` value of a Canvas frame: its viewport
    or its saved variant, then its scheme, such as `expanded-light`.
  - **Compact picker:** the frame picker of the compact layout. It is a
    native select, and its checked option shows its frames in place.
- **Background:**
  - The Canvas design mockups under `examples/basic/specs/design/canvas/`
    draw the Changes tab in Side by side. The stage holds the pair of every
    compared frame, so that the compact picker can swap pairs in place.
  - A desktop render turns compact below the shell's breakpoint, so its
    document also holds every pair.
  - In Side by side, `CanvasStage` sets `data-cv-chosen` on `.cv-frames` to
    the id of the picked frame. That id equals the frame name of both frames
    of the chosen pair.
  - Each chosen frame name has a wide hide rule. The rule hides every frame
    whose name differs, as in
    `.cv-frames[data-cv-chosen="default-light"] .cv-frame:not([data-cv-frame="default-light"])`.
  - `design-canvas-changes.css` names the four screen frames.
    `design-canvas-components.css` names `default-light`, `compact-light`,
    and `expanded-light`.
  - Below the breakpoint, in `@container cv (width < 56.25rem)`, the compact
    picker shows the frames of its checked option. Its rules, such as
    `.cv-work:has(option[value="compact-dark"]:checked) .cv-frame[data-cv-frame="compact-dark"]`,
    have a higher specificity than the hide rules, so they win there.
  - The three variant sets in Side by side build their pairs with one
    helper, `sidePairs` in
    `examples/basic/specs/design/canvas/components/parts/sketches.tsx:87`.
    These are Default, the removed Compact, and the failed Expanded story,
    whose `expandedSideFrames` is at
    `examples/basic/specs/design/canvas/stories/parts/sketches.tsx:145`.
- **Problem:** Each comparison needs a hide rule for its own chosen frame
  name. The failed story comparison, `design/canvas/stories/failed/changes`,
  chose `expanded-light`, and no rule named it. So its desktop stage showed
  both pairs, four frames in place of two. On 2026-11-25 the branch added an
  `expanded-light` rule. The next comparison with a new chosen frame meets
  the same omission.
- **Screenshot:** The finding asked for a picture of Failed story in Changes
  on desktop, with Expanded · Light selected. It boxes the extra Expanded ·
  Dark pair. No picture was saved. Before the direct fix, the desktop view
  showed the pairs of Expanded · Light and Expanded · Dark.
- **Impact if no action:** A later Side by side mockup can again show every
  pair on a desktop. It then gives implementers the wrong comparison layout.
- **Root question:** How does every Side by side stage show only its chosen
  pair on a wide canvas, whatever its frame name?
- **Options:** The letters follow the options of the review finding and of
  its finding check on the source branch. The branch applied A for
  `expanded-light`, with a desktop regression case. It also made the story
  pairs use the shared `sidePairs`.
  - **A.** Keep one hide rule for each chosen frame name, and add a rule for
    each new comparison. Effort: Small for each comparison, repeated.
  - **B.** Make the shared stage mark the chosen pair, and replace the
    per-frame hide rules with one generic rule. Effort: Medium.
    - In `CanvasStage`, mark each frame slot whose frame name equals the
      picked id. Derive the name as `canvas-frame.view.tsx:100-113` does. The
      name is the viewport of a screen frame or the saved variant of a
      component frame, then the scheme.
    - Use one shared helper for that name, so that the mark and
      `data-cv-frame` cannot differ.
    - Hide every frame outside the marked pair with one rule. Delete the
      per-frame rules at `design-canvas-components.css:93-100` and
      `design-canvas-changes.css:150-159`.
    - Put the generic rule in the wide container query,
      `@container cv (width >= 56.25rem)`. Or give it a lower specificity
      than the compact picker rules. Otherwise the compact picker cannot show
      the other pairs.
    - Outside the wide query, the rule must hide the `.cv-frame`, not its
      slot. A hidden slot hides its frame whatever rule shows the frame. The
      Frames filter hides the slot for that reason.
    - Keep the regression case of the direct fix passing. It is the desktop
      case "the failed story shows one Expanded · Light pair side by side" in
      the Serve run of `tests/browser/component_design_cases.ts`. It expects
      only the two `expanded-light` frames on
      `design/canvas/stories/failed/changes`.
    - Check every Side by side artboard on a desktop and on a phone:
      - `design/canvas/changes/side-by-side`
      - `design/canvas/evidence/styles`, with its `unresolved` and `unnamed`
        variants
      - `design/canvas/components/affected`, with its `details` and `direct`
        variants
      - `design/canvas/components/compare/side-by-side`
      - `design/canvas/components/removed/changes`
      - `design/canvas/stories/failed/changes`
  - **C.** Draw the chosen pair in a wide-only stage, and the pickable pairs
    in a separate phone stage. The document then holds the chosen pair twice.
    `tests/helpers/design_rules.ts:168` rejects repeated instance keys in a
    view, so one stage must scope its instance names. Effort: Medium.
  - **D.** Make the checked option of the compact picker the one source of
    the shown pair in both layouts. Effort: Medium.
    - Move the picker's show rules out of their compact container queries.
    - Add one rule that hides the frames of a Side by side stage with a
      picker. Delete `data-cv-chosen` and its rules.
    - One list of per-frame rules then remains, the picker's.
    - The wide layout then reads a hidden control. A missing rule empties the
      stage in both layouts, so every Canvas artboard with a picker needs a
      visual check.
- **Left out:**
  - Removing the Dark pair from the document: the compact picker swaps to
    that pair in place.
  - Removing the other pairs from the desktop document only: a desktop
    document turns compact below the breakpoint, and the stage has no
    viewport input.
  - Generated per-frame rules: a generated stylesheet needs a drift check,
    which is a new gate, and B removes the list without one.
  - A test or a lint for the class: B is structural and needs no guard.
- **Wider fix:** B.
- **Previous examples:** The Canvas redesign, commit `6d4f4f6cf`, added
  separate rules for Default and Compact in the same stylesheet. Commit
  `54e0a948e` added the failed story comparison without a rule for
  `expanded-light`.
- **Recommendation:** B. One mark and one rule cover every Side by side
  stage, so a new comparison needs no change of a stylesheet.
- **Action:** fix after merge, apply B, because B replaces the selection
  rules of existing comparisons across the Canvas family.
