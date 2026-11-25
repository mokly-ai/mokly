# Folio Chrome: Account Entry

Status: The app does not draw sign in's password section yet. [Milestone 6](../../../plans/preview-password-sign-in.md#milestone-6-sign-in-password-section) builds it.

The account entry composition of [Folio chrome](./folio-chrome.md): the one
panel every account screen shares. Every value comes from
[Design tokens](./design-tokens.md); the screens that draw it are listed in
[Product mockups: account](./product-mockups-account.md), and the links that
leave it for the marketing site follow [Marketing site](./marketing-site.md).

## Account Entry

Every account screen — sign in, sign up, the magic link, the sign-in callback
and all three onboarding steps — is one composition, so nothing about the frame
moves as the user walks the flow: one panel width, one header height and one
footer, signed in or not. The panel is the screen's subject; the page around
it carries only the identity and the two legal links.

- **Canvas**. A `background` page, 100vh minimum, carrying a 1px `border` dot
  on a 24px grid across the whole page, header and footer included; the panel
  is the only surface that covers it. Mobile drops the dots.
- **Header**. A fixed 48px bar (`layout.topbar`) with no hairline, holding at
  most one trailing item, itself a 44px target: the account identity when
  signed in, one ink link on the magic-link screen (Sign in), and nothing on
  sign in, sign up or the callback. The entry screens' switch already sits
  inside the panel. The bar keeps its height empty or full, so the panel does
  not move when the user signs in. No bordered button, no Docs, no Changelog.
- **Identity**. The avatar and the reader's name, by the same rule as the
  viewer's account trigger: a reader who has set a display name is called by
  it, with their email as the identity's tooltip (`title`) so the account
  behind the name is one hover away; a reader who has not set one is called by
  their email, whole, with no tooltip, because the label is already the whole
  value. It is the only place an onboarding step names the reader, so no panel
  repeats it.
- **Panel**. One `surface` card at `layout.entryMax` (440px) with a 10px
  radius, a hairline and `shadow.medium` — the Lifted role in
  [Design tokens](./design-tokens.md). It is centered on the canvas and
  optically raised, because the main region carries more bottom padding than
  top and a geometrically centered panel sits visibly low. Its body is padded
  40px.
- **Mark**. The wordmark sits inside the panel, 32px above the title. The brand
  belongs to the form the reader came for, not to a header that holds one link.
  It leaves for the site's home on the logged-out screens and is inert once the
  user is signed in; the mark and the wordmark keep the design and the colours
  that [Shell brand](../mokly-shell-brand.md) defines.
- **Title**. One line of `heading3` in sentence case, one color, 32px above the
  body. An optional 13px muted line sits under it only when it changes a
  decision.
- **Body**. One column, 20px between fields, every action full width. Entry
  stacks the GitHub action in the `secondary` tone with its mark, the `or`
  rule, the email field, then the one `primary` submit. Where the
  configuration answer names a shared account, sign in adds a second `or`
  rule, the **Password** field and a `secondary` action named for that
  account, as [Preview sign-in](./preview-sign-in.md#sign-in-section)
  defines, so the submit stays the one `primary`. In the desktop app's
  window, entry draws only its one `primary` action, which opens the browser,
  as [Desktop sign-in](./desktop-sign-in.md#entry-screen) defines. A step
  pairs its `primary` with at most one `secondary` alternative when there is a
  real second path. The way back is the back link centered under the actions:
  the back glyph and "Back" in medium ink, underlined on hover, a 44px target
  and never a button, so nothing green sits under the primary.
- **Facts**. Read-only values are hairline-separated rows — 13px muted label
  at the left, 13px medium ink value at the panel's right edge — not a filled
  panel. A grey box around a value reads as a disabled input, and a fixed label
  column strands the value mid-panel at this width.
- **Selection field**. A value the reader chooses from a list is the
  registered `design/selector`: a labelled field the width of the panel,
  searchable when it opens, never an options list drawn open inline, so a row
  is chosen by a press and nothing highlights on hover. One 13px muted line
  sits under it when the list may be short of what the reader wants, carrying
  an ink link to where the list is changed — on the repository step, the
  installation's page on GitHub, in a new tab.
- **States**. Empty, loading and error bodies render flush inside the panel,
  dropping the card the **State** composition draws elsewhere: the panel is
  already that card, and a second border around one sentence is two frames for
  one message. Their glyph, title, line and single action are unchanged. A
  wait draws its screen's own layout in the panel, as the
  [Wait](./folio-chrome.md#compositions) composition defines, so a step draws
  its title and its strip while it waits. A landing or a resolver, such as a
  sign-in callback or `/dashboard`, draws its title over one loading body,
  because its success replaces the route and leaves no layout of its own to
  wait for.
- **Below**. At most one 13px line under the body, centered, with an ink link:
  the opposite entry screen, the way to correct an address, or the finished
  project's CI setup guide while its default branch publishes. The link clears
  44px on mobile.
- **Progress**. The three setup steps — Workspace, Install, Repository —
  as a footer strip attached to the panel: a `surfaceMuted` band on the
  panel's bottom corners, three equal columns, each a 24px chip over a 12px
  label. Completed chips show a check, the current chip fills with ink and
  takes `aria-current="step"` above a semibold label. It carries no accent and
  appears on those three screens only; entry, the magic link, the callback and
  the finished project have no step to report. Mobile keeps the strip as the
  panel's foot: a hairline, then the current step's name in semibold ink with
  `Step 2 of 3` muted at the trailing edge, over a three-segment 4px track
  (`border` pending, `borderStrong` complete, ink current). Three labelled
  columns cannot hold their words at 320px and an edge-to-edge panel has no
  band to tint.
- **Footer**. Terms and Privacy only, 12px muted and centered on the site
  origin. The finished project's CI setup guide is the one other outbound
  documentation link the family carries, beneath its body or as its leading
  action; everything else that leaves belongs to the marketing site's own
  chrome, per [Marketing site](./marketing-site.md).
- **Mobile**. The panel goes edge-to-edge: no border, no fill, no shadow and no
  padding of its own, so the body sits on the canvas at 20px gutters, top
  aligned rather than centered. The header wraps rather than clipping, keeping
  both gutters at 320px with 200% text.
