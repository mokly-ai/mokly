# Embedded viewer styles need CSS @scope

- **Severity:** Medium (estimate). **Effort:** Large (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-30, from the branch `calummoore/mokly-ui-component-migration`, during the research for its page-rules decision.
- **Location:** `packages/viewer/scripts/styles.mjs:32-56`, `docs/protocol/mokly-viewer.md:129`.
- **Reason:** The problem is older than that branch, which keeps the embedded stylesheet transform unchanged.

- **Terms:**
  - **Embedded stylesheet:** `@mokly/viewer/styles.css`, the stylesheet
    that a React host imports for `MoklyViewer`. The `embeddedStyles`
    function of `packages/viewer/scripts/styles.mjs` writes it at build
    time.
  - **`@scope` rule:** a CSS at-rule that limits its rules to a subtree of
    the page, between a root and an optional lower boundary.
- **Background:**
  - `embeddedStyles` wraps every shell rule of the embedded stylesheet in
    one `@scope (.mokly-viewer) to ([data-mokly-slot])` block. The rules
    then reach the viewer root, and they do not reach the host page or the
    host's slot content.
  - The MDN browser compatibility data for `css.at-rules.scope`, read on
    2026-10-30, gives these versions: Chrome and Edge 118, Firefox 146, and
    Safari 17.4.
  - The same data says that Safari 26.0 to 26.3 applies no rule inside
    `@scope` to `<input>` and `<textarea>` elements. Safari 26.4 fixes
    this.
  - A browser without `@scope` support drops the whole block.
  - No protocol doc states which browsers the embedded viewer supports. The
    theming section of `docs/protocol/mokly-viewer.md` describes the scoped
    stylesheet but not its browser needs.
  - Other embeddable React libraries scope by class names instead. Radix
    Themes declares its tokens on the `.radix-themes` root element and
    resets elements through a `.rt-reset` class that each component adds.
    Fluent UI React v9 sets its tokens as CSS variables on the element that
    `FluentProvider` renders.
- **Problem:** In Firefox before 146, an embedded viewer gets none of its
  shell rules. In Safari 26.0 to 26.3, its inputs, such as the catalogue
  search and the prop fields, get no shell rules.
- **Impact if no action:** A host on those browsers shows an unstyled viewer
  or unstyled inputs, and nothing warns the host.
- **Root question:** Which browsers must the embedded viewer support, and
  how does its stylesheet stay inside the viewer on each of them?
- **Options:**
  - **A.** State the supported browsers in `docs/protocol/mokly-viewer.md`:
    the versions that apply `@scope` fully. Change no code. Effort: Small.
  - **B.** Keep `@scope`, and let `MoklyViewer` check for it when it mounts,
    for example with `typeof CSSScopeRule`. When it is missing, the viewer
    reports one `onError`. This detects the problem but does not style the
    viewer. Effort: Medium.
  - **C.** Author every shell rule under the root class, with resets that
    each component applies to its own elements, as Radix Themes does. Then
    remove the `@scope` transform. Every browser that supports `:where()`
    styles the viewer, and no rule reaches slot content. Effort: Large.
- **Left out:** None.
- **Wider fix:** C.
- **Previous examples:** None found.
- **Related:** `plans/ui-package-shell-views.md` keeps the transform and
  lists its removal as a post-merge task, which C covers.
- **Recommendation:** C. It removes the dependency on a new CSS feature and
  scopes the viewer the way other embeddable libraries do. A records the
  limit while C waits.
- **Action:** ask the user, because condition 3 holds: C is Large.
