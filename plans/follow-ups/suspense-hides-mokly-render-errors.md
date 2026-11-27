# Suspense boundaries hide Mokly's render errors

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the implementation review of the branch
  `calummoore/storybook-track-f-failed-stories-omid`, round 2, outside the
  scope. The finding checks of findings 11 and 12 found it.
- **Location:**
  - `packages/mokly/src/sidecar/render-markup.ts`, `renderMarkup`, which
    renders each screen, component, and story view with
    `renderToStaticMarkup` of the catalogue's `react-dom/server`.
  - `node_modules/react-dom/cjs/react-dom-server-legacy.node.production.js:6626`,
    in React 19.2.3: `function onError() {}`, the empty error handler of
    `renderToString` and `renderToStaticMarkup`. The development build has
    the same empty handler at
    `node_modules/react-dom/cjs/react-dom-server-legacy.node.development.js:8351`.
  - The checks of Mokly's own code that throw while React renders:
    `componentWrapper` in `packages/mokly/src/authoring/components.ts`, which
    throws for a duplicate instance id and raises `component-props`, and the
    session `link` in `packages/mokly/src/sidecar/render-session.ts`, which
    raises `unknown-link-definition`.
- **Reason:** Screen and component renders on `origin/main` have the same
  problem, and its fix changes how every React render reports an error,
  outside the failed-story work of the branch that found it.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Suspense boundary:** a `<Suspense>` element of React, which shows its
    `fallback` while its content is not ready.
  - **Static renderer:** `renderToStaticMarkup` of `react-dom/server`, which
    renders a React tree to HTML in one synchronous call.
  - **Mokly's own checks:** the checks that Mokly's authoring code runs while
    React renders, such as the duplicate instance id check of the `Component`
    wrapper of a registered component.
- **Background:**
  - The sidecar renders each screen, component, and story view with the
    static renderer of the catalogue's React.
  - React's server renderer catches an error that a component inside a
    Suspense boundary throws. It renders the fallback of the boundary in place
    of the content, and it gives the error to its `onError` handler. The
    static renderer has no `onError` option, and its handler does nothing.
  - A probe with React 19.2.3 on 2026-11-25 rendered a component that throws
    `duplicate instance id`:
    - Inside `<Suspense fallback={<p>fallback</p>}>`, `renderToStaticMarkup`
      returned `<p>fallback</p>` and did not throw.
    - Inside a Suspense boundary without a fallback, it returned an empty
      string and did not throw.
    - Outside a Suspense boundary, it threw the error.
    - `prerenderToNodeStream` of `react-dom/static`, with an `onError`
      option, gave the error to `onError`. Its markup holds the fallback and
      React's markers of a failed boundary, such as `<!--$!-->` and a
      `template` element with the error text.
  - Mokly's own checks report an error with a throw during the render. These
    errors include a duplicate instance id, `component-props` for props that
    fail the schema of a registered component, and `unknown-link-definition`
    for a link to a definition that no entry module exports.
  - Section "Stability Rule" of `docs/protocol/mokly-instances.md` says that
    duplicate local ids are build errors. Section "Failed Views" of
    `docs/protocol/mokly-storybook-failures.md` says that each error of
    Mokly's own code stops the build, also in a story.
  - An error of the author's own code inside a Suspense boundary also gives
    the fallback. So a story whose component throws there gives no failed
    view, and a screen whose component throws there gives no `render-failed`.
- **Problem:** When a check of Mokly's own code throws inside a Suspense
  boundary, React renders the fallback and drops the error. The sidecar never
  sees the error, so the render succeeds with the fallback in place of the
  content. This holds for screen, component, and story renders.
- **Impact if no action:** A build or a publication can pass with a duplicate
  instance id, props that fail their schema, or a link to an unexported
  definition. The catalogue then shows the fallback in place of the content.
- **Root question:** How can each error of Mokly's own code stop its render,
  also inside a Suspense boundary?
- **Options:**
  - **A.** Record the first error of Mokly's own code on the render session
    where Mokly raises it. The helper that marks each error of Mokly's own
    code since the review fix of 2026-11-25 can write the record. After React
    returns, fail the render with the recorded error. An author error inside a Suspense boundary still gives
    the fallback, as in React's own server rendering. Effort: Medium.
  - **B.** Render with `prerenderToNodeStream` and its `onError` option, and
    fail the render on each reported error. This also fails author errors
    inside a Suspense boundary, which is a new build error. It makes every
    React render asynchronous, and the markup changes, so each document
    needs the failed-boundary markers removed. Effort: Large.
- **Left out:** Only two approaches are real, because the static renderer
  gives Mokly no hook for a caught error. Mokly must record the error itself
  or use another React API.
  - A Suspense that renders its content with no boundary during Mokly's
    renders: a lazy component that suspends then fails the render, where it
    shows its fallback today.
  - Mokly's own checks that render nothing in place of a throw: a later check
    can then meet the state that the failed check left, and A already fails
    the render.
  - A search of the static markup for a fallback: the static renderer writes
    no marker of a failed boundary.
  - Change nothing: builds then pass catalogue errors that the protocol pages
    call build errors.
- **Wider fix:** A. A record where Mokly raises the error does not depend on
  how React or author code handles the throw.
- **Previous examples:** Round 2 of the same review found the same class for
  story cleanups: an earlier story error hides a fatal cleanup error. The
  Related line names its item.
- **Related:** `plans/follow-ups/story-errors-hide-fatal-cleanup-errors.md`, a
  shared wider fix: its option D records the first fatal error on the render
  session, as option A here does. One record can serve both items. Neither
  fix waits for the other.
- **Recommendation:** A. It enforces the rules of Mokly's own checks in every
  render and keeps React's behaviour for the author's own errors.
- **Action:** fix after merge, apply A, because the problem is on
  `origin/main` for screen and component renders, outside the failed-story
  work of the branch that found it.
