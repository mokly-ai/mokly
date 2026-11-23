# Static evidence check guards only one render start

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Low. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-19, from decision 4 of the miss-first base capture
  branch `calummoore/mokly-first-changes-1-miss-first-capture-66in` and the
  options check of that decision. The branch applied the check at the
  early-render start. The options check named a check at the callback
  boundary as the wider fix.
- **Location:** `crates/mokly-cli/src/base_render_admission.rs:15` to line
  38, `crates/mokly-cli/src/changes_static.rs:16`,
  `crates/mokly-cli/src/changes_base.rs:174` to line 181,
  `crates/mokly-graph/src/types.rs:111`,
  `crates/mokly-graph/src/document_composition.rs:16`,
  `crates/mokly-graph/src/session_render.rs:47`,
  `crates/mokly-graph/src/temporary.rs:114`,
  `docs/protocol/mokly-export.md:166`, and
  `docs/protocol/mokly-base-preparation.md:69`.
- **Reason:** No current path breaks the rule, and a check at the callback
  boundary needs its own proof that output and error precedence stay equal.

- **Source:** Implementation.
- **Category:** Code structure.
- **Terms:**
  - **Base document callback:** the author code that renders one base view,
    such as the `render` function of a mockup module or a `definePage`
    callback.
  - **Source evidence:** the input digests and read witnesses that
    `InputTree::verify` in `crates/mokly-static/src/fingerprint.rs` checks
    for `build` and `publish`.
  - **Early render:** a render of a base view that no render cache tier
    holds. It starts as soon as base graph preparation knows the document
    key, before the capture reaches the view.
  - **Admission policy:** the `BaseRenderAdmission` trait in
    `crates/mokly-cli/src/base_render_admission.rs`. `StaticBase` in
    `crates/mokly-cli/src/changes_static.rs` verifies the source evidence.
    `ImmediateBaseRenders`, the policy of Serve, checks nothing.
  - **Composition function:** `document_composition::document` in
    `crates/mokly-graph/src/document_composition.rs:16`, which composes each
    document and runs its callback.
- **Background:**
  - The rule in force is at `docs/protocol/mokly-export.md:166`: "Bundled
    modules and PostCSS witnesses are compared before document callbacks
    run." `docs/protocol/mokly-base-preparation.md:69` adds: "Static
    commands verify their source evidence before early renders start."
  - Before the miss-first branch, `StaticBase` wrapped the base provider. It
    verified the evidence after the provider returned. Every base callback
    ran later, in the capture.
  - The miss-first branch starts early renders inside the provider, right
    after graph preparation. On 2026-11-19 its first complete gate failed the
    Node test "base PostCSS package witnesses reject changes before document
    callbacks" in `tests/static_postcss_base_evidence.test.ts:83`. A base
    callback ran before the check.
  - On 2026-11-19 the branch chose to inject a policy at the common start.
    `NativeBase` calls `BaseRenderAdmission::admit` after `graph.prepare`, at
    `crates/mokly-cli/src/changes_base.rs:178`. `admit` runs `check`, and
    then it starts early renders through
    `RenderGeneration::prefetch_comparison`, at
    `crates/mokly-cli/src/base_render_admission.rs:23`. `build` and
    `publish` use `StaticBase`. Serve uses `ImmediateBaseRenders`.
  - That choice kept four facts of `main`. For `build` and `publish`, the
    check runs once, on the classification thread, after graph preparation
    and before any base callback, as before. It keeps its typed errors and
    the failure order. Serve still starts known misses immediately.
  - Today `admit` is the only production caller of `prefetch_comparison`.
    Both policies use the provided `admit`. So no current path runs a base
    callback before the static check.
  - The guard sits at the start, not at the callback.
    `prefetch_comparison` is a public method of `RenderGeneration` at
    `crates/mokly-graph/src/types.rs:111`. `admit` is a provided method, so a
    new policy can override it and skip `check`.
  - Every base callback passes the composition function. Two paths reach
    it: `Session::raw` at `crates/mokly-graph/src/session_render.rs:47`, and
    temporary documents at `crates/mokly-graph/src/temporary.rs:114`.
  - Today a failed check returns a `BasePreparationError`. `Changes` gives a
    recorded base source failure precedence over it.
    `crates/mokly-cli/src/build_changes.rs` maps a changed input to
    `BuildError::Static`, which prints
    `[mokly/export-invalid] Inputs changed during the build`. After any other
    comparison failure it calls `verify` again, at line 53. The build also
    verifies once more before installation, at
    `crates/mokly-cli/src/static_build.rs:207`.
  - A fix must keep these requirements:
    - The output bytes and the terminal error of `build` and `publish` stay
      equal.
    - The failure precedence stays equal: a recorded base source failure
      first, then a changed input before other comparison failures.
    - The check runs once for each base preparation and keeps its typed
      errors.
    - Serve starts known misses immediately and checks nothing.
    - No setting, gate, retry, timeout, process, or new rejection is added.
- **Problem:** The static evidence check guards the one place that starts
  early renders, not the place where base callbacks run. A new start, or a
  policy that overrides `admit`, can run a base callback before the check.
- **Impact if no action:** A later change can run author code of a rejected
  static build before the build rejects its changed inputs. The static
  PostCSS evidence test catches this in the complete gate, but only for the
  paths that it runs.
- **Root question:** How can every base document callback, also one from a
  future start, wait for its command's evidence check, while output, error
  precedence, and the Serve start stay equal?
- **Options:**
  - **A.** Change nothing. The check stays at the one start, and the
    end-to-end test detects a bypass on the paths that it runs. Effort:
    Small.
  - **B.** Keep the admission check, and add a backstop at the composition
    function. Both call one check object, which runs `verify` once and keeps
    the result. The static runtime gives that object to the base session
    through `Runtime::for_base`. Serve gives none. Today the admission
    always runs first, so the backstop never runs `verify`. The check point,
    the thread, the errors, and their order then stay equal. A future start
    that skips the admission gets the check before its first callback. Cost:
    changes in `mokly-render` and `mokly-graph` constructors, and a mapping of
    a backstop failure to the same typed error. Effort: Medium.
  - **C.** Move the check to the composition function only. `NativeBase`
    then starts early renders with no policy. Cost: the check moves to the
    first render thread. A base with no miss runs no check at the base stage,
    so the check before installation rejects the build later, with the same
    `BuildError::Static`. A failed check becomes a render failure, so the
    failure order can change. The sentence at
    `docs/protocol/mokly-base-preparation.md:69` changes to "before any base
    document callback". Effort: Medium.
  - **D.** Split the base provider into a prepared-key phase and an
    admitted-render phase for every caller. A render handle then exists only
    after the admission. Cost: it changes the preparation boundary of every
    provider and caller in `mokly-compare` and `mokly-cli`. Effort: Medium.
- **Left out:**
  - A start of static early renders after the provider returns and verifies.
    It still guards one start, as the current fix does, and it duplicates the
    start and lifetime code.
  - Early renders in Serve only, with the outer static check of `main`. It
    answers whether static commands start early renders. A later static
    start would raise this item again.
  - A static `RenderGeneration` wrapper. Early renders call `Session::raw` on
    the inner session, so a wrapper never sees them.
  - A check at the end of graph preparation, through the graph factory or
    `Runtime::for_base`. It runs at the same point and on the same thread as
    the current check, so it is not a distinct approach.
  - A guard that rejects a callback when the check has not run. It adds a new
    rejection, which the always-on rules reserve for the user. B and C run
    the existing check instead.
  - A lint or a test that rejects new callers of `prefetch_comparison`. It
    adds a gate or a test for the class, which the rules reserve for the
    user.
  - Removing the static check. It breaks the rule at
    `docs/protocol/mokly-export.md:166`.
  - Delaying the Serve early renders until the capture. It breaks their start
    point in `docs/protocol/mokly-base-preparation.md`.
- **Wider fix:** B. Every callback passes its check, so a new start cannot
  bypass it. C is the same structural fix with the check moved, at the cost
  of the error timing.
- **Previous examples:** The checking-wrapper notes on `RenderGeneration` at
  `crates/mokly-graph/src/types.rs:98` and line 121 record forwarded calls
  that bypass the checks of a wrapper. The static PostCSS evidence test found
  the first early-render case on 2026-11-19.
- **Related:** `plans/follow-ups/scripts-off-flag-record.md` changes how
  `BasePreparationError` carries the scripts-off flag. `admit` builds that
  error. `NativeBase` drops its flag at
  `crates/mokly-cli/src/changes_base.rs:180` and adds it again at line 60. A
  fix of either item touches the same code.
- **Recommendation:** B. It covers every callback path, and it keeps the
  check point, the thread, the typed errors, and the failure order of every
  current path. C is simpler, but it changes when and where a static build
  reports changed inputs. If B cannot keep the output and the error
  precedence equal, the item waits for the user, because C changes the
  error order.
- **Action:** fix after merge, apply B, because the branch already guards
  its only start, and the backstop needs its own proof of equal output and
  error precedence.
