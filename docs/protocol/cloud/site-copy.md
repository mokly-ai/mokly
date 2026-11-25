# Site Home Copy

This is the approved home-copy sub-contract of [Site](./site.md). The
[source rule](./site.md#boundary) lets the home draw the demo app, and
[Site design](./site-design.md) owns the look.

## Home Copy

Structure, top to bottom: the hero with its copy and the spread under it, the
features with the Browse, Review and Edit frames, and the open foundation,
which closes the page with its facts and the three steps. On desktop the Specs
panel floats beside the frames. A phone stacks the hero copy, the spread, the
features and the open foundation, with no Specs panel. The home has no Inspect
panel. The approved copy:

**Hero**

- No kicker above the heading.
- Heading: `Design in code.`, drawn as a selected text layer. It is one line
  on desktop and two lines on a phone.
- Lead: `Generate an interactive mockup of your entire app using your existing
React, HTML and CSS components.`
- Primary action: **Get started →**. Secondary action: **Download for Mac**.
  [Site](./site.md#get-started) gives their targets.

The home page's description repeats the lead, and every social card closes
with the heading. The copy is written once for all three, so a change to the
hero reaches search results and shared links in the same edit.

**Spread** (under the hero copy): the demo app on the canvas, zoomed out. A
Specs box labelled `acme/storefront · main · 24 screens` holds phone and
desktop artboards of its screens in both schemes. A Components box beside it,
or under it on a narrow window or a phone, holds the app's component sets and
the quiet `works with Storybook` label with the official Storybook icon; the
[Storybook guide](../../guides/authoring/storybook.md) backs that claim. On a
phone Specs shows three phones. The cursors of the people and agents in the
file rest on it.

**Specs panel** (desktop only): the panel `Specs` lists the page's sections as
in-page links: Hero, `Browse, review, edit.`, 01 Browse, 02 Review, 03 Edit,
Open foundation and Footer. The row of the section in view is current.

**Features**: heading `Browse, review, edit.` with the second line `One place
for all of it.` Lead: `Every branch becomes a catalogue your whole team can
open.` Each feature has a kicker, a heading, a body and a labelled frame on the
canvas:

- 01 Browse — `A visual diff for every branch.` — `Each branch and pull request
publishes a catalogue built from your real components. Changes shows what
moved, and the check on the pull request counts it.`
- 02 Review — `Sticky comments.` — `Each comment is tied to the component it
is about, so it stays put when the layout changes. Approve when it is right,
in step with the pull request review.`
- 03 Edit — `Ask for the change beside the screen.` — `An agent edits the
mockup source in a live branch session. Click an element to bring it into the
conversation, then publish back to the branch.`

The Browse frame shows the demo pull request's Mokly check, which leads into
the depicted viewer. The viewer lists the product's five
[compare modes](../mokly-comparison-panes.md) in their order and shows Swipe,
with its divider between the base and the branch. The Review frame shows a
comment thread pinned to a selected component of a demo screen, with Approve.
The Edit frame shows an agent session that edits the mockup source of the
selected component, with Publish. Each demo ends in that state, and reduced
motion shows it at once.

**Open foundation**: kicker `An open foundation`; heading `Your screens.` with
the second line `Your building blocks.`; body `Author locally with the
open-source Mokly CLI. Keep your screens in Git and host the catalogue
anywhere. The cloud adds hosting, review and the agent; it never owns the
source.` Then **Docs →** and **View on GitHub**. The open-foundation
frame wires a demo screen's mockup source to the screen it renders, with the
build in a terminal under the source. Four facts follow: `@mokly/mokly`,
`MIT license`, `The CLI runs locally` and `Host the catalogue anywhere`. The
three steps close the page:

1. `Shape the next screen.` — `Author with React and your shared components.`
2. `Publish the branch.` — `Open the pull request check to review the screens
that changed.`
3. `Build from a shared decision.` — `Keep comments and approvals with the
pull request.`

Tone reference: short and plain, one idea per sentence. Section headings take
two lines, and the second line is muted. Install commands appear only in the
docs.
