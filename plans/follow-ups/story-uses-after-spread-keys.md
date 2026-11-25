# Story uses with a key after a spread

- **Severity:** Medium. **Likelihood:** Common. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the branch `calummoore/storybook-track-i-story-component-usage-mpng`, track I of the Storybook support plan.
- **Location:** `packages/mokly/src/sidecar/virtual-modules.ts:47-57`, `packages/mokly/src/sidecar/plugins.ts:135-149`, `packages/mokly/src/sidecar/vite-plugin.ts:166-170`.
- **Reason:** The record of story component uses works for every other JSX form, and a facade for `react` touches both compile paths.

- **Source:** Design.
- **Category:** Product bug.
- **Terms:**
  - **Story component use:** a JSX element whose type is the `component` of
    a stories file's meta. Mokly records it as an instance of that stories
    entry in the rendered screen.
  - **JSX development shim:** Mokly's own `react/jsx-dev-runtime` module. Its
    `jsxDEV` function sees each JSX element of the modules that Mokly
    compiles, with esbuild and under the Vite adapter.
- **Background:**
  - Mokly compiles JSX with the automatic runtime in development mode, so
    each element calls `jsxDEV`.
  - esbuild and Babel compile an element whose `key` follows a spread, such
    as `<Card {...item} key={item.id} />`, to `createElement` from `react`.
  - `createElement` does not pass through the shim.
- **Problem:** A story component use in that form records no instance. A use
  with the `key` before the spread records one.
- **Impact if no action:** Lists in that common form give no usage evidence.
  Their uses stay in the screen's own comparison, so Changes lists the
  screen as a direct change, not as an affected screen.
- **Root question:** How does Mokly record a story component use that its
  compiler turns into a `createElement` call?
- **Options:**
  - **A.** Keep the limit, and keep the advice in the Storybook guide to put
    `key` before the spread. Effort: Small.
  - **B.** Give compiled repository modules a Mokly facade for `react`, whose
    `createElement` runs the same hook as `jsxDEV`, with esbuild and under the
    Vite adapter. Effort: Medium.
  - **C.** Add a compile step that moves a `key` after a spread in front of
    the spread. It changes the order in which props apply, so a `key` inside
    the spread can win. Effort: Medium.
- **Left out:** A lint that rejects a key after a spread: it adds a new
  check, and it does not cover installed code either.
- **Wider fix:** B. Every element of a compiled module then reaches one hook.
- **Previous examples:** None found.
- **Recommendation:** B. Prop order must not decide whether a use records.
- **Action:** fix after merge, apply B, because the facade is its own change
  on both compile paths, and the guide states the limit until then.
