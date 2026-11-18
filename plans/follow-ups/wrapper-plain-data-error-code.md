# A plain-data error fails with the wrong code

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-03, from the branch `calummoore/rust-viewer-checks-plan`: the options check of decision 3 of the plan for the viewer checks.
- **Location:** `packages/mokly/src/authoring/components.ts:78` and `:80-88`, and `packages/mokly/src/sidecar/render.ts:203-208`.
- **Reason:** The check found it while it read the wrapper code for a plan, and that plan changes no code yet.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Wrapper:** the component that `defineComponent` of `@mokly/mokly` returns. The Node sidecar renders it when a screen uses the component.
- **Background:**
  - The wrapper copies the data props with `copyData` at `components.ts:78`.
  - `copyData` throws a `DataError` for a function, a class instance, a symbol key, or a cycle, in `packages/mokly/src/authoring/data.ts:13-38`.
  - The `try` block that turns a failed check into the `component-props` error starts later, at `components.ts:80`.
  - So a `DataError` reaches `packages/mokly/src/sidecar/render.ts:203-208`, which reports it as `render-failed`.
  - `docs/protocol/mokly-component-props.md:55-59` says that accessors, symbols, cycles, functions, and class instances fail `component-props`.
- **Problem:** A screen that passes a function as a data prop gets the `render-failed` code, not `component-props`.
- **Impact if no action:** The author sees a render failure in place of the prop error that the protocol gives, so the message names the wrong cause.
- **Root question:** How does every plain-data failure of a wrapper call reach the author as `component-props`?
- **Options:**
  - **A.** Move the `copyData` call into the `try` block at `components.ts:80-88`. Add a regression test with a function prop. Effort: Small.
  - **B.** Make `DataError` a `SidecarError` with the code `component-props`, so every caller reports it the same way. Effort: Small.
- **Left out:** Change the protocol to allow `render-failed`: the protocol's code tells the author which input to fix, and that reason holds.
- **Wider fix:** B, because each future caller of `copyData` then gets the right code.
- **Previous examples:** None found.
- **Recommendation:** B. It fixes the code for every caller with the same effort as A.
- **Action:** fix after merge, apply B, because the bug is outside the plan's scope and the plan changes no code yet.
