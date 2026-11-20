# Upgrade guide overstates per-component providers

- **Severity:** Low. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-17, from the gap list `plans/follow-ups/mokly-upstream-gaps-to-file.md`, which the Mokly 0.18.0 upgrade of the cloud wrote on 2026-11-02 on the branch `calummoore/mokly-cli-upgrade`. The move of Mokly Cloud into this repository split that list into items.
- **Location:** `docs/guides/start/upgrade.md:94-95`, `docs/protocol/mokly-rendering.md:58-63`, and `packages/mokly/src/authoring/components.ts:113-140`.
- **Reason:** The fix is a guide change outside the scope of the change that moved Mokly Cloud into this repository.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Renderer:** the consumer module that the `renderer` configuration names. The sidecar calls it around each React screen render and each React component render, as `docs/protocol/mokly-rendering.md:58-63` states.
- **Background:**
  - `renderScreen` renders a React screen, and `renderComponent` renders one React component instance, as `docs/protocol/mokly-rendering.md:17-20` states. The renderer wraps each of these renders.
  - A registered component inside a React screen renders inline, in the React tree of the screen. Its instance wrapper renders the component's `render` as a child element between its markers, in `packages/mokly/src/authoring/components.ts:113-140`. So it shares the providers of the screen's renderer.
  - A component's own page and a component in an HTML screen render through `renderComponent`, inside their own renderer.
  - `docs/guides/start/upgrade.md:94-95` says: "Each component render sets up its own providers, so pass values such as a palette through declared component props." The guides ship with the npm package.
  - The Mokly 0.18.0 upgrade of the cloud found this difference.
- **Problem:** The guide says that each component render sets up its own providers, but a component inside a React screen shares the providers of the screen.
- **Impact if no action:** An author can read a context value that only the screen supplies, and then see another result on the component's own page.
- **Root question:** What does the upgrade guide tell authors about the providers around a component render?
- **Options:**
  - **A.** Rewrite the sentence. A component's own page and a component in an HTML screen render inside their own renderer, and a component inside a React screen shares the providers of the screen. Keep the advice to pass values such as a palette through declared props, so that every page of the component gets them. Effort: Small.
  - **B.** Give each registered component inside a React screen its own renderer. It changes the rendered output and the Changes of every React screen with components. Effort: Large.
- **Left out:** Remove the sentence. Authors then lose the advice to pass shared values through props.
- **Wider fix:** None. `docs/protocol/mokly-rendering.md:58-63` already names the renders that the renderer wraps.
- **Previous examples:** None found.
- **Recommendation:** A. The guide then matches the code and the protocol, and it keeps the advice.
- **Action:** fix after merge, apply A, because the guide contradicts the code and the fix is outside the scope of the change that found it.
