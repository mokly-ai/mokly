# Canvas redesign: site design calls

These are the design calls of the site milestones of the
[Canvas redesign plan](./canvas-redesign.md), as the
[design record](./canvas-redesign-design.md) keeps them for the other
milestones. This file is a part of the plan, and the pull request that deletes
the plan deletes it too.

- Calls on Milestone 4, 2026-11-21: the site keeps the scheme choice under
  `mokly.site.scheme`; the control shows only after its island marks the
  page; `?scheme=` stays in the address for that view; nav links and the bar's
  Get started draw 36px tall in a 44px target band; the menu sheet slides 8px
  from its top edge and dims only the area below the bar; until Milestone 6 a
  docs page keeps Search docs as a 36px icon in the bar from 768px; headings
  balance their lines.

- Calls on Milestone 6, 2026-11-21:
  - The docs `h3` is 20px on desktop and 18px on mobile.
  - The frame label names the tracked source under its own root. Edit on
    GitHub opens `github.com/mokly-ai/mokly/edit/main/` and that path.
  - Section is always a page fact. Version and Package show only for guides
    and Reference pages.
  - Without script, both search controls and the sub-bar stay hidden.
  - The scroll spy marks the last heading above a line 22% down the window.
    Below 1280px, On this page is a disclosure that counts the `h2` sections.
  - Code panels use Shiki's dark colours in both schemes, at 8.52:1 or more.
  - A docs code panel keeps the mockup's extra 8px above and below. On mobile
    it reaches 6px into the margins.
- Calls on Milestone 9, 2026-11-21:
  - The link check accepts only the app's `/sign-up`.
  - Two measured redlines replace the mockup's static values, and the Team
    size tag shows the frame's live size.
  - The plan facts come from the plan catalogue, and a test holds them equal
    to the Rust `CATALOGUE`.
  - The page has no reveal animations.

- Calls on Milestone 5, 2026-11-21 and 2026-11-22:
  - Scope: `stage` leaves `slug.rs` and the segment lists, and `pricing`
    stays. The mockups build leaves the `cloud-site` suite, the site
    workflow and the Lighthouse job. `SITE_STAGE_PR` and the stage leftovers
    in `.gitignore`, `tsconfig.json` and `apps/README.md` go.
  - Milestone 5 built the shared Canvas parts first, in `946ba25c9`: the
    section box, redline, size tag, cursor, Mokly avatar, panel, code panel,
    measurements island and the full icon set.
  - The site keeps the strict tint check, so 12 demo app mixes use two roles.
    Six of them only swap their parts. Decision 26 holds the four that move.
  - Codex stalled twice on the stage removal, so a Claude subagent did that
    one task.
  - The old Folio `.site-hero` rules leave `layout.css`, and the shared
    `.site-actions` rule takes the mockup's values. Only the home uses them.
  - A mockup phone rule that adds a property also gets its desktop value in
    the desktop rule, so the parity test compares every home selector. The
    mockup drawings did not change (0 differing pixels).
  - Every demo and the hero load motion fill `backwards` and play once. The
    load motion moves only decorations, never the heading or the lead.
  - The hero's size tag, type badge and redline read live values. The demo
    app's own values are static.
  - `code.css` is split into `code.css` and `code-tokens.css`.
- Calls on Milestone 8, 2026-11-22:
  - The sample view's document fills the screen below the status band or the
    browser bar, at 390 × 800 or 1280 × 760. Desktop scales with CSS only;
    Mobile keeps a fixed 60%.
  - The view takes no pointer, and the island finds the element under it.
    The view uses the light scheme in both site schemes. Its controls show
    only when the island runs, and each band keeps its radios in its own form.
  - On load, the island lights the view's first heading.
  - The changelog's Atom feed keeps each note group line. A group heading
    that the site does not know keeps its own words and counts only in All.
  - The Breaking filter keeps the upgrade notes of the releases it shows. A
    filter choice opens the compact frames it shows, and All closes them.
  - The release in view is the last shown frame whose top is above a line
    32px below the jump target. Version history sticks at 72px, and the
    filter bar keeps the mockup's 74px.
  - Note links stay live, and a relative link to a published guide goes to
    the guide's site page.
  - The trail rules live in `layout.css`.
- Calls on Milestone 20, 2026-11-22 (orchestrator, under Cal's delegation):
  - The desktop 200% text pass is a follow-up item; `site-design.md` asks
    for 320px only.
  - The home moves its px text to rem, as `site-design.md` already requires,
    with the hero heading capped by the window width.
  - Privacy section 9 also names the desktop sign-in verifier and the
    desktop session cookie's SameSite value. Terms section 1 drops
    "React-authored", as `terms-describe-react-only-mockups.md` option A
    says. Both legal edits are separate commits for Cal's review.
  - The site README split is a follow-up item.
