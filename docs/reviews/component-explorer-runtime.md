# Component Explorer Runtime Review

Implementation `f27b8ae` completes the component explorer milestones in
[the plan](../../plans/component-explorer.md) and integrates main `a0e349a`.
The source tip before integration was `b68e84a`. Conflicts were resolved
individually; no mainline files or features were deleted. Comparison controls
were intentionally removed from views without changes, as requested.

The required `cargo xtask review` ran after the implementation commit was
pushed. Both findings below were independently confirmed by tracing the code
and reading the cited documentation. They remain open for the user's decision;
no automatic review fixes were applied.

## Findings

1. **Medium — a watched restart can mix catalogue and controls generations.**
   In [serve_watched.ts](../../src/server/serve_watched.ts), the rebuild and
   reconfigure paths call `replaceComponentRuntime` before restarting the
   child. [supervisor.ts](../../src/server/supervisor.ts) both retains that
   runtime and sends it immediately to the current child. The child's existing
   [HTTP server](../../src/server/http.ts) replaces its controls service while
   retaining the manifest/catalogue captured at startup. Reconfiguration also
   awaits the previous watcher closing before the restart, extending the window.

   Doing nothing leaves a brief interval in which a page can advertise a new
   rendering generation alongside old variants or control metadata, causing
   stale-generation failures or previews inconsistent with the visible page.

   Options: **A**, split retaining the next runtime from applying it to the
   current child; **B**, pass the runtime through an atomic restart operation;
   **C**, disable controls while a restart is pending.

   **Recommended: A**, plus ordering assertions at the supervisor boundary and
   a delayed-restart integration regression. This makes the lifecycle distinction
   explicit and protects both rebuild and reconfigure paths. Merely moving one
   call leaves the ambiguous API and the other path vulnerable. Existing watcher
   fakes currently discard runtime replacement calls, so they cannot detect this
   ordering error. B is a reasonable larger lifecycle refactor; C introduces an
   additional transient UI state without resolving the mixed-generation model.

2. **Low — delivered contracts retain stale implementation-status wording.**
   [The component authoring contract](../protocol/mokly-components.md) says
   its API is unavailable beneath a delivered-status introduction;
   [Changes](../protocol/mokly-changes.md) still calls component attribution
   planned; [prop validation](../protocol/mokly-component-props.md) describes
   the implemented validator/tests as TODOs. The root [README](../../README.md)
   also describes the legacy fallback as v3-only, although component manifests
   use v4. The public API, validator, attribution engine, and v4 reader are
   implemented and covered by the passing suites.

   Doing nothing leaves contradictory guidance for authors and maintainers,
   increasing the chance of following an obsolete contract during future work.

   Options: **A**, correct the remaining status and version paragraphs;
   **B**, move historical delivery wording into plan history and link to a
   canonical capability-status section; **C**, add focused consistency checks
   for delivered protocol files, excluding historical plans/review records.

   **Recommended: A + C**, matching the reviewer, with B wherever delivery
   status is repeated. A resolves current inaccuracies; narrow checks and fewer
   duplicated status statements reduce recurrence. A repository-wide phrase
   ban would incorrectly reject legitimate historical documentation.

## Validation

- `cargo xtask check`: 693 TypeScript unit/integration tests, 179 Chromium
  browser tests, and 4 Rust tests pass. Dependency audit, formatting, lint,
  typechecking, deterministic example verification, package checks, packed
  consumer smokes, Rust fmt/clippy, and the Rust file-length audit pass.
- All 136 generated HTML views were opened directly from disk and visually
  inspected in 23 paired contact sheets. Actual mobile/desktop component
  controls were exercised with real Firna providers, edited values, dark mode,
  consumer navigation, and nested highlighting.
- [CI](https://github.com/mokly-ai/mokly/actions/runs/34470928866) passes on
  Node 22.14 and Node 24, including Required CI and macOS/Windows export checks.
  [Preview deployment](https://github.com/mokly-ai/mokly/actions/runs/34470928847)
  succeeds. Published mobile/desktop smoke checks pass saved variants, read-only
  props, themes, Usage links, nested highlighting, and absence of local rendering
  or watch requests.
- The workspace development server was refreshed at `http://127.0.0.1:4173`;
  actual Action prop editing and Reset pass against that running server.
- The reviewer independently passed diff formatting, direct no-emit TypeScript
  checks, and ESLint. Its read-only sandbox could not create the temporary build
  directory needed by Example Check; the root full gate and both CI Node jobs
  completed that check successfully.

The delivery record is documentation-only and receives Markdown validation,
its own commit/push, and the required review after that push. Any additional
findings from that review are reported in the final handoff without automatic
fixes.
