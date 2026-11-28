# Class story component uses with a ref record nothing

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-28, from the branch `calummoore/storybook-track-i-story-component-usage-mpng`, track I of the Storybook support plan, design call I17.
- **Location:** `packages/mokly/src/sidecar/story-use.ts`, the `classBody` method, and `packages/mokly/src/sidecar/virtual-modules.ts`, the JSX development shim.
- **Reason:** The use renders correctly and its output stays in the screen's comparison, and the case is rare in React 19 code.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **Story component use:** a JSX element whose type is the `component` of
    a stories file's meta. Mokly records it as an instance of that stories
    entry in the rendered screen.
  - **Hidden invocation prop:** the Symbol-keyed prop that Mokly's JSX
    development shim adds to a story component element. It carries the key,
    the invocation source, and the slots of the use to the component's
    instrumented body.
- **Background:**
  - Mokly instruments each component that it compiles, so that the
    component's own body writes the instance markers of a story component
    use.
  - The body finds its use through the hidden invocation prop.
  - React 19 copies the props without `ref`, with `for...in`, before it
    builds a class instance. `for...in` skips Symbol keys.
  - On the server, React gives a class component neither the ref nor the
    original props object.
  - For `forwardRef` components, Mokly finds the use through a weak map keyed
    by the ref value, because the render function receives the ref.
- **Problem:** A use of a class story component with an explicit `ref`, such
  as `<ClassView ref={ref} />`, records no instance.
- **Impact if no action:** The component's page does not list that screen,
  and an edit of the component's own render shows as a change of the screen,
  not once on the component's page. The screen's comparison still shows
  every edit, because the use's output is the screen's own output.
- **Root question:** How does a class story component use with an explicit
  `ref` find its invocation on the server?
- **Options:**
  - **A.** Keep the limit, and state it in the Storybook guide. Effort:
    Small.
  - **B.** Give such a use a Mokly element of its own type around it, as for
    a story component that Mokly does not compile. A parent that checks
    `child.type` then sees the Mokly element for that use. Effort: Small.
  - **C.** Instrument the class constructor as well, and match the props
    that it receives against the invocations recorded for its type in the
    current render, key by key, as the `forwardRef` lookup does by ref.
    Two uses with equal props stay ambiguous and record nothing. Effort:
    Medium.
- **Left out:** Replace the ref with a Mokly ref: the product then sees
  another ref value.
- **Wider fix:** C. It covers every class use whose props differ from its
  siblings.
- **Previous examples:** Design call I17, the `forwardRef` lookup by ref.
- **Recommendation:** C. It keeps the element type and records the common
  case.
- **Action:** fix after merge, apply C, because the use renders correctly
  and its output stays in the screen's comparison.
