# A first lazy render gives its fallback

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from round 2 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`: the finding check of
  finding 132 put it outside the scope.
- **Location:** `packages/mokly/src/sidecar/render.ts:133`,
  `node_modules/react/cjs/react.production.js:264`, and
  `node_modules/react-dom/cjs/react-dom-server-legacy.node.production.js:6658`.
- **Reason:** The render call predates the Vite adapter work of the branch
  that found it, and no requirement says how a render handles a lazy
  component.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **`React.lazy`:** A React wrapper for a component whose module loads with
    a dynamic import. React shows the nearest Suspense fallback until the
    module loads.
  - **Generation:** One compiled catalogue. A worker can render many views of
    one generation.
- **Background:**
  - The sidecar renders each view with React's synchronous
    `renderToStaticMarkup`, at `packages/mokly/src/sidecar/render.ts:133`,
    through the style collection of Emotion and styled-components.
  - That renderer aborts pending work
    (`node_modules/react-dom/cjs/react-dom-server-legacy.node.production.js:6658`
    to line 6673). No code waits for a pending `React.lazy` import.
  - A `React.lazy` payload keeps its loaded module for the rest of the
    generation in the same worker
    (`node_modules/react/cjs/react.production.js:264` to line 282).
  - The render call came with commit `d935e6a66`, before the Vite adapter.
    React 19.2.3 is installed. React 19 also has a static prerender API,
    `prerenderToNodeStream` in `react-dom/static`, which waits for every
    Suspense boundary.
  - A view shows lazy content when its module loaded before the render, for
    example after a top-level `await import()`
    (`tests/fixtures/vite/src/page.mockup.ts:7`) or a Storybook loader
    (`docs/protocol/mokly-storybook.md:136`).
- **Problem:** The first render of a generation that reaches a `React.lazy`
  component gives its Suspense fallback, or fails when no boundary encloses
  it. A later view of the same generation in the same worker can render the
  loaded component. So views of one entry can differ by render order. This
  comes from a read of the code. Nobody ran it.
- **Impact if no action:** A view can show a fallback in place of its
  content. The head and the base side of Changes can differ only because
  their workers rendered in another order.
- **Root question:** How does a view that renders a `React.lazy` component
  give the same output in every render order?
- **Options:**
  - **A.** Keep the synchronous render, and render again after a pending lazy
    load. When a render leaves a `React.lazy` payload pending, wait for it
    within the render deadline, and render the view again. The sidecar owns
    the side's one React runtime, so it can track the payloads that a render
    reaches. Test a view with a lazy component as the first render and as a
    later render. Effort: Medium.
  - **B.** Render each view with React's static prerender API, which waits
    for every Suspense boundary within the render deadline. Cost: a new
    render path for the style collection of Emotion and styled-components.
    Each Suspense use then waits, also for data. Effort: Large.
  - **C.** Fail a render that leaves a lazy payload pending, with a
    diagnostic that names the component and asks for a static import or a
    top-level `await import()`. Cost: a new failure, so the user must approve
    it. Effort: Small.
- **Left out:** State the fallback in the docs only. It fails the goal,
  because views still differ by render order.
- **Wider fix:** B. It gives each suspending component, not only
  `React.lazy`, its content in each render.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/vite-lazy-css-order.md`: its option F links
  lazy CSS by the imports that resolved before a view rendered, so that
  option needs this item first.
- **Recommendation:** A. It makes the output independent of render order, and
  it keeps the current render path and style collection. Choose B if the user
  also wants other Suspense content to render.
- **Action:** ask the user, because no requirement says whether a render
  waits for a lazy component, and each option changes the output of the
  views that use one.
