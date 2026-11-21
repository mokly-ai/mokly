# Canvas redesign: decisions 1 to 5

This file and [decisions 6 to 12](./canvas-redesign-decisions-viewer.md) hold
the open decisions of the [Canvas redesign plan](./canvas-redesign.md). They
are a part of that plan, and the pull request that deletes the plan deletes
them too. The [design record](./canvas-redesign-design.md) holds the design
source, Cal's decisions in force and my design calls.

Cal answered decisions 1 to 10 on 2026-11-20. Each answered item ends with
his answer, and the milestones follow it. Decisions 11 and 12 came from the
mockups and wait for Cal. The options check of 2026-11-20
added options and changed two recommendations. Its transcript is in
`.context/canvas-redesign/`.

## Shared terms

- **Canvas:** the new design language. The site and the viewer look like a
  design file: a dot-grid canvas, labelled frames, green selection boxes with
  square handles and size tags, Geist type and one signal green.
- **Folio:** the design system that the site and the app use today. The
  `@mokly-cloud/tokens` package under `packages/tokens` holds its values.
- **`@mokly/ui`:** the open-source package under `packages/ui` that draws the
  Browse shell. `mokly serve`, the static build and the cloud app all use its
  one stylesheet.
- **Stage:** the area of the viewer that shows the rendered screen frames.
- **Prototype:** the static Canvas pages in
  `.context/canvas-design/site-concepts/`. The design record says where they
  come from.

## Summary

| No. | Title                                          | Severity | Effort | Recommended | Chosen                   |
| --- | ---------------------------------------------- | -------- | ------ | ----------- | ------------------------ |
| 1   | Canvas look for open-source Mokly              | High     | Large  | A           | D                        |
| 2   | Home demo content and the source rule          | Medium   | Medium | A           | A, relaxed until go-live |
| 3   | Pricing page and links to the app              | Medium   | Medium | A           | A                        |
| 4   | Button colour below the access minimum         | Medium   | Small  | A           | A                        |
| 5   | Brand mark and wordmark                        | Medium   | Medium | B           | B                        |
| 6   | Stage with several frames and zoom             | Medium   | Medium | A           | C                        |
| 7   | Inspect and Changes right panel                | Medium   | Large  | D, was B    | C                        |
| 8   | Overlay compare as a divider                   | Low      | Small  | D, was B    | C                        |
| 9   | Live presence in the app                       | Low      | Small  | A           | A                        |
| 10  | Docs "Your first screen" showpiece             | Low      | Small  | A           | C                        |
| 11  | Canvas designs for the remaining Browse states | Medium   | Large  | D, was B    | open                     |
| 12  | New automatic checks from the mockup reviews   | Low      | Small  | D, was A    | open                     |

## 1. Canvas look for open-source Mokly

- **Severity:** High. **Effort:** Large.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `packages/tokens/src/tokens.ts`, `packages/ui/src/theme/theme.css`, `docs/protocol/mokly-viewer-palette.md`, `docs/protocol/mokly-viewer-appearance.md`, `docs/protocol/cloud/design-tokens.md`
- **Background:** Cal asked for the viewer to follow the Canvas design, except
  the Comment and Agent tabs. The cloud app hosts `@mokly/viewer`, and
  `@mokly/ui` draws all of its shell. `@mokly/ui` has its own private theme with
  Inter. Only three accent properties are public.
- **Problem:** The cloud viewer can look like Canvas only if `@mokly/ui`
  changes. A change of its defaults also changes `mokly serve` and every
  static build. Today four files hold copies of the values, and no test ties
  them together.
- **Impact if no action:** The marketing site and the app chrome look like
  Canvas, but the viewer inside the app keeps the Folio look.
- **Root question:** Which surfaces take the Canvas look: the site and the
  cloud chrome, the viewer inside the cloud, or also the open-source viewer?
- **Options:**
  - **A.** One look everywhere. Change the values in `packages/tokens`, the
    `@mokly/ui` theme, the Markdown style of `mokly-html` and the design
    mockup sheet to Canvas. Open-source users get the new look. Effort:
    Large.
  - **B.** Canvas in the cloud only. `@mokly/ui` adds documented theme
    properties for type, neutrals, radii and shadows, and the cloud passes
    Canvas values. This changes the rule in `mokly-viewer-appearance.md` that
    the viewer has no general palette API. Effort: Large.
  - **C.** Canvas on the site and the app chrome only. The viewer keeps its
    look and takes only the green accent. Effort: Medium.
  - **D.** A, from one open-source source. A palette module in `@mokly/ui`
    generates the theme stylesheet and the Markdown style. `packages/tokens`
    imports the shared values from it. A drift check guards the output.
    Effort: Large.
  - **E.** `@mokly/ui` ships Canvas as a second built-in palette that the
    host selects. Open source keeps its look, and the cloud selects Canvas.
    Two looks need care. Effort: Large.
- **Left out:** A site-only look, because Cal asked for the viewer to follow
  the design. A cloud override of the private `--chrome-*` roles, because
  `viewer-host.md` says they are not extension points.
- **Wider fix:** D, because one source cannot drift. A edits copies.
- **Previous examples:** Folio took the Browse shell's Inter so that the cloud
  chrome stays in the Mokly family (`design-tokens.md`).
- **Related:** Decision 5 has the same copy problem for the mark.
- **Recommendation:** A. The site sells the open-source CLI first, so the
  open-source viewer must look like the product on the site. D best protects
  the codebase.
- **Action:** answered. It waited for the user, because the change reaches every open-source user,
  and no recorded decision covers that.
- **Answer:** Cal chose **D** on 2026-11-20: one look everywhere, generated from one open-source palette source in `@mokly/ui`, with a drift check.

## 2. Home demo content and the source rule

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/cloud/site.md`, `docs/protocol/cloud/site-copy.md`, `docs/protocol/cloud/site-design.md`
- **Background:** The design draws a made-up coffee shop app, `acme/storefront`,
  with people (Maya, Sam), agents, `#482` and `24 screens`. It also redraws
  the viewer. The site today shows one real screen from the repository's own
  catalogue in a sandboxed frame.
- **Problem:** `site.md` says every value comes from a real source, with no
  invented customers. Every option keeps the named people and counts that
  Cal approved, so every option changes this rule.
- **Impact if no action:** The home page cannot show the design's spread,
  frames and demos.
- **Root question:** What may the home page show as example product content?
- **Options:**
  - **A.** Draw the demo as static Astro components at build time. Allow a
    clearly fictional demo app, and keep every claim about Mokly real.
    Effort: Medium.
  - **B.** Author `acme/storefront` as a real example catalogue. Mokly renders
    it at build time, and the site stages the output. The people and counts
    still need the rule change. Effort: Large.
  - **C.** Keep the real dogfood screens inside the Canvas frames, with no
    coffee shop. Effort: Medium.
  - **D.** A, but draw the viewer in the Browse frame from the real
    `@mokly/ui` components at build time, as the cloud viewer mockups do.
    It conflicts with decision 8, option D. Effort: Large.
- **Left out:** Client-side templates, as in the prototype, because A draws
  the same content at build time and is better on every point.
- **Wider fix:** B for the screens, and D for the viewer chrome.
- **Previous examples:** The current stage in `apps/site/scripts/stage.mjs`.
- **Recommendation:** A. It keeps the design and keeps the work a redesign.
  B best protects the claim that Mokly renders the screens.
- **Action:** answered. It waited for the user, because every option changes the source rule in
  `site.md`.
- **Answer:** Cal chose **A** on 2026-11-20. The source rule is relaxed only until go-live, because the site is not live yet and comments and agents ship before go-live.

## 3. Pricing page and links to the app

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/cloud/site.md`, `docs/protocol/cloud/marketing-site.md`, `apps/app/src/config.ts:59`
- **Background:** The design adds `/pricing` with Open source, Free and Team.
  The facts come from `billing.md`. **Create an account** and **Start a 7-day
  trial** open `/sign-up`. The Plans and billing docs page already lists the
  seat prices. The app billing pane links `/pricing`, which does not exist.
- **Problem:** `site.md` says the site has no pricing page and links to no app
  route until the cloud launch. The site build fails on a link to a path
  that it does not publish.
- **Impact if no action:** The app keeps a broken Pricing link.
- **Root question:** Where does a reader, on the site or in the app, see the
  plan prices and start a plan?
- **Options:**
  - **A.** Add `/pricing` now with the app links. Change both rules, and let
    the link check accept the app paths. Effort: Medium.
  - **B.** Add `/pricing` now. The cloud plan actions open the Plans and
    billing docs page until launch. Effort: Medium.
  - **C.** Leave pricing for the cloud launch. Effort: Small.
  - **D.** No pricing page. The header Pricing link and the app link open the
    Plans and billing docs page. Effort: Small.
  - **E.** The app reads its site paths from a file that the site route list
    generates, with a drift check. It works with any option. Effort: Medium.
- **Left out:** An unlisted page, because Cal put Pricing in the header.
- **Wider fix:** E, because it catches any broken app link to the site.
- **Previous examples:** The Worker's site-segment file is generated the same
  way (`apps/site/scripts/generate-site-segments.ts`).
- **Recommendation:** A. Cal said the cloud features ship before go-live, and
  the app already needs the page. E best protects the codebase, and it can
  ship with A.
- **Action:** answered. It waited for the user, because the recommended option changes two rules
  in `site.md`.
- **Answer:** Cal chose **A** on 2026-11-20.

## 4. Button colour below the access minimum

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `apps/site/tests/contrast.test.ts:18`, `docs/mockups/src/_tests_/tokens.test.ts:80`, `docs/mockups/src/_tests_/shared-ui-theme.test.ts:92`, `docs/protocol/cloud/site-design.md`
- **Background:** Cal chose the button green `#109f5c` with white text on 19
  November. It measures 3.42:1. The app's primary button uses the same token
  pair as the site.
- **Problem:** `site-design.md` and `design-tokens.md` ask for 4.5:1 text
  contrast. Three tests fail below 4.5:1.
- **Impact if no action:** The token milestone cannot pass the gate.
- **Root question:** Which fill and label colour do the filled buttons use on
  the site, in the app and in the viewer?
- **Options:**
  - **A.** Keep `#109f5c` with white text everywhere. Lower the pair to 3:1
    in the three tests and both docs. Effort: Small.
  - **B.** Keep the rule. Use `#0c854c` with white text, 4.69:1. It is almost
    the green that Cal rejected. Effort: Small.
  - **C.** Keep `#109f5c` with ink text, 5.46:1. Effort: Small.
  - **E.** `#109f5c` with white text on the site only, through a site role
    with a recorded 3:1 exception. The app and the viewer keep a 4.5:1 pair.
    The site and the product then draw buttons differently. Effort: Small.
- **Left out:** Larger button text, because bold text counts as large only
  from 18.66px, and the design's buttons use 14px to 15.5px. Option D of the
  first draft became a design call: the docs tree keeps 44px rows.
- **Wider fix:** None, because the rule already exists.
- **Previous examples:** None found.
- **Recommendation:** A. Cal accepted 3.42:1, and the viewer prototype uses
  the same fill. B best protects access.
- **Action:** answered. It waited for the user, because the options weaken three gate tests or
  reverse Cal's colour choice.
- **Answer:** Cal chose **A** on 2026-11-20.

## 5. Brand mark and wordmark

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `apps/site/public/brand/`, `packages/ui/src/icons/icons.tsx`, `docs/protocol/cloud/site-design.md`, `docs/protocol/mokly-shell-brand.md`
- **Background:** The design draws the mark with an ink outline frame behind a
  green front layer. The wordmark `mokly.` is Geist, not the Georgia serif.
  The prototype did not change the brand files.
- **Problem:** More than ten files hold copies of the mark: the brand files,
  the favicon, the social cards, the app, the shell, the emails and the
  desktop icon.
- **Impact if no action:** The new header shows a mark that the brand files
  do not match.
- **Root question:** Which mark and wordmark does Mokly use after the redesign?
- **Options:**
  - **A.** Keep the current mark and serif wordmark. Effort: Small.
  - **B.** Adopt the new mark and Geist wordmark in every copy, the emails
    included. Effort: Medium.
  - **C.** New mark and wordmark on the site only. Effort: Small.
  - **D.** B, from one source. `@mokly/ui/icons` exports the shape, every
    surface draws from it, and the brand files and the desktop icon are
    generated from it. Effort: Large.
- **Left out:** None.
- **Wider fix:** D, because B edits each copy by hand.
- **Previous examples:** None found.
- **Related:** Decision 1. Option C fits only decision 1, option C.
- **Recommendation:** B. A design-tool brand needs one mark on every surface.
  D best protects the codebase.
- **Action:** answered. It waited for the user, because the prototype marked the mark as a
  proposal.
- **Answer:** Cal chose **B** on 2026-11-20.
