# Stylesheet roots span names a missing parent

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-17, from the options check of the parallel render input
  keys plan, on branch `calummoore/mokly-parallel-render-keys-6m85`.
- **Location:** `crates/mokly-render/src/stylesheets.rs:92`,
  `crates/mokly-render/src/graph.rs:46`, line 61, and line 183,
  `crates/mokly-render/src/bundle.rs:232`,
  `crates/mokly-graph/src/graph.rs:51`, and
  `crates/mokly-cli/src/serve_trace_stages.rs:17`.
- **Reason:** The branch that found the problem changes only render input key
  scheduling, and a rename of this span is a separate diagnostic change.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Timing span:** a `tracing` span that the timing layer prints as JSON
    records when a command runs with `--debug-timings`. The span name is the
    `stage` of each record.
  - **Timing layer:** the tracing layer in `crates/mokly-cli/src/serve_trace.rs`.
    It prints only the stages that `crates/mokly-cli/src/serve_trace_stages.rs`
    allows. It takes the `parentId` of a record from the nearest enclosing
    timed span.
- **Background:**
  - `roots` in `crates/mokly-render/src/stylesheets.rs:92` finds the
    stylesheet roots of a JavaScript catalogue. It carries
    `#[tracing::instrument(name = "graph.prepare.stylesheet-roots", skip_all)]`.
  - The prefix of the name puts the stage under `graph.prepare`.
    `Graph::prepare` opens that span, at `crates/mokly-graph/src/graph.rs:51`.
  - `JavaScriptGraph::prepare` in `crates/mokly-render/src/graph.rs` calls
    `self.graph(...)` at line 46. `self.graph` calls `stylesheets::roots` at
    line 183. Only after that does line 61 call `graph.prepare(...)`, which
    opens the `graph.prepare` span.
  - `describe` in `crates/mokly-render/src/bundle.rs` calls `class_maps`.
    `class_maps` calls `stylesheets::roots` at line 232. This JavaScript
    description path is in `mokly-render`, and `Graph::prepare` does not call
    it.
  - So neither call site runs inside `graph.prepare`. The `parentId` of each
    record of this stage is the nearest enclosing timed span of the caller,
    not `graph.prepare`.
  - `docs/protocol/mokly-timings.md` says that stage names and counts are
    diagnostic details, not a stable public API. So a rename needs no protocol
    change.
  - The same contract says that parent spans include their children, and
    that a reader must never sum parent and child durations.
  - Only two places name the stage: the instrument attribute and the
    allowlist entry at `crates/mokly-cli/src/serve_trace_stages.rs:17`. No
    doc, Rust test, or script under `scripts/large/` names it.
- **Problem:** The stage name says that stylesheet root discovery is part of
  `graph.prepare`. The work runs before `graph.prepare` opens, or in
  JavaScript description.
- **Impact if no action:** A reader of the timing records can count this work
  inside `graph.prepare`. That reader then misreads where preparation time
  goes.
- **Root question:** How does the timing stage of stylesheet root discovery
  show where that work runs?
- **Options:**
  - **A.** Change nothing. The name keeps a prefix that suggests a parent
    that the span does not have. Effort: Small.
  - **B.** Rename the span to a name without the `graph.prepare.` prefix, for
    example `render.stylesheet-roots`. Update the allowlist entry in
    `crates/mokly-cli/src/serve_trace_stages.rs` in the same change. Effort:
    Small.
  - **C.** Open `graph.prepare` earlier, in `JavaScriptGraph::prepare`, so
    that it also covers `self.graph(...)`. The first call site then runs
    inside `graph.prepare`. This changes what `graph.prepare` measures, so
    earlier measurements no longer compare. The `describe` call site stays
    outside. Effort: Small.
- **Left out:**
  - Move root discovery into `Graph::prepare`. B fixes the name with a much
    smaller change, and the `describe` call site would still run outside.
  - A protocol doc change. The timings contract makes stage names diagnostic
    details, so a rename needs none.
- **Wider fix:** None. A check that every prefixed stage runs inside its
  named parent would be a new test for the class, which needs the user.
- **Previous examples:** None found.
- **Recommendation:** B. A rename removes the false parent from the name, and
  it keeps the order of work and the scope of `graph.prepare`.
- **Action:** fix after merge, apply B, because the rename lies outside the
  render input key change that found it.
