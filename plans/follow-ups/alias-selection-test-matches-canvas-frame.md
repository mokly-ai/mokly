# The alias selection test matches a canvas frame

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-23, from `calummoore/canvas-redesign-m13-cloud-viewer-chrome-4gms`, while its cloud viewer chrome work ran the application specs that open the switcher.
- **Location:** `packages/app/src/_tests_/viewer/entry.spec.ts:168-170`, the test "a reference alias carries the whole selection to the publication". The two elements: `packages/viewer/src/shell/canvas_live_frame.tsx:119` and `packages/ui/src/variant-bar/variant-bar.tsx:49`.
- **Reason:** The flaky locator is in a test that the branch did not change, and the same failure happens on the commit before that branch's work.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Strict locator:** a Playwright query that must match exactly one element before an element assertion can run. A query that matches two elements fails at once, with no retry.
  - **Canvas frame:** a preview frame of the viewer's canvas stage. `canvas_live_frame.tsx` draws its `iframe` only after the frame's source resolves, and gives it `data-workspace-variant` with the variant's path.
- **Background:**
  - The test opens a branch alias and a pull request alias whose query names the component variant `notice/draft`, then waits for the `Notice` heading.
  - It then asserts `expect(page.locator('[data-workspace-variant="notice/draft"]')).toHaveAttribute("aria-current", "page")`. The element it means is the variant's link in the variant bar, `variant-bar.tsx:49`, which carries the same attribute.
  - Since the canvas stage draws variant frames, the frame's `iframe` carries that attribute too, once its source resolves.
  - The failure text: `Error: strict mode violation: locator('[data-workspace-variant="notice/draft"]') resolved to 2 elements: 1) <iframe ... data-workspace-variant="notice/draft" ... title="Draft — desktop — light"> 2) <a ... aria-current="page" href="/view/notice/draft/" data-workspace-variant="notice/draft">Draft</a>`.
  - With `--repeat-each=5 --retries=0`, the test failed 2 of 5 runs on commit `74b0e4c8c`, before the branch's work, and 2 of 3 runs on the branch. Each failure gave the same text.
- **Problem:** The assertion's locator matches the canvas frame as well as the variant link, so the test passes only when the assertion runs before the frame's source resolves.
- **Impact if no action:** The test fails about half of its runs. The configuration's one retry often hides it, but a run whose two tries both lose the race fails the application suite and blocks a pull request.
- **Root question:** How does the test find the variant link alone, whatever the canvas has drawn?
- **Options:**
  - **A.** Find the link by its role and name, `page.getByRole("link", { name: "Draft" })`, scoped to the variant bar if the canvas ever gains a link of that name, and keep the `aria-current` assertion. Effort: Small.
  - **B.** Keep the attribute and narrow it to the link element, `page.locator('a[data-workspace-variant="notice/draft"]')`. Effort: Small.
- **Left out:** Waiting for the frames before the assertion, because it keeps an ambiguous locator and only moves the race.
- **Wider fix:** None, because one locator causes it. A search of `packages/app/src/_tests_` and `tests/` for other `data-workspace-variant` locators finds the rest of the class, if any.
- **Previous examples:** `plans/follow-ups/flaky-component-design-removed-preview.md`, another strict locator that matched two viewer elements.
- **Recommendation:** A. A role and a name find what the reader sees, as the browser test rules of the shared `testing` skill ask.
- **Action:** fix after merge, apply A, because the test is outside this branch's change and fails the same way on the commit before it.
