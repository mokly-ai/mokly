# Product Copy

This contract applies to user-facing text in the web app, the public site,
emails, GitHub check summaries and bot comments, and mockups. It covers
headings, helper text, empty states, status messages, errors, confirmations,
and action labels.

## Voice

Mokly speaks to engineering-led teams and the product people who review
their work. Write plainly, in the second person, about outcomes: what was
published, what changed, what needs a decision. Use the product's own nouns
(screen, publication, branch, pull request, comment, approval) in headlines,
status, and actions. Internal nouns (bundle, manifest, inventory, tarball,
blob, worker) stay out of primary copy.

Two readers see recovery copy. A product reviewer in the browser needs the
outcome and an action they can take themselves. A developer on GitHub or in
CI output needs enough to fix the cause. Give the reviewer the primary copy;
give the developer a clearly secondary details surface (an expandable
details section, a CLI error line, or a check run's details text) where
exact file paths, version numbers, and validation names are correct and
useful. Never promote those details into the headline.

Keep a positive frame. Say what Mokly does and what the reader can do next;
never lead with what it lacks. State a genuine limit only when the reader
needs it, pair it with what they can do instead, and keep it out of
headlines.

## Minimum Necessary Copy

Include only what the user needs to understand the outcome, make a decision,
or take the next action. If removing a sentence preserves all three, remove
it.

- State the outcome or action directly, using familiar product language.
- Treat the heading, body, nearby labels, and buttons as one message. Say each
  thing once; do not repeat a title in the body or explain an obvious button.
- Supporting text is optional. Do not give every heading a subtitle, every
  field helper text, or every status a paragraph by default.
- Do not narrate system behavior, fallback behavior, unchanged state, or
  obvious consequences unless that information changes a decision or recovery.
- Remove filler introductions, repeated reassurance, and speculative causes.
- Keep implementation rationale and exhaustive behavior in the spec or in
  non-screen mockup notes.

## Defaults By Message Type

- **Status and success:** a short label or sentence. Add a next step only when
  the user needs one.
- **Empty states:** name what is absent and offer the available action.
  Explain the feature only when its purpose is not clear from the screen.
- **Helper text:** include only a constraint or distinction needed to complete
  the task correctly. Omit instructions already conveyed by the field label.
- **Errors:** state what failed, then one useful recovery action when
  available. Prefer a short title and at most one short sentence of support.
  A clearly labelled recovery button can supply the action.
- **Confirmations:** name the action and the material consequence needed for
  consent. Do not list everything the action leaves unchanged.
- **GitHub check summaries and bot comments:** one line of outcome with
  counts, then links. The developer reading it is on GitHub and wants the
  link, not an explanation of Mokly.

These are defaults, not hard word limits. Preserve specific correction
guidance, material partial success, uncertain outcomes, irreversible effects,
and required disclosures. Put optional background in contextual help; keep
information needed before acting visible at the decision point.

Do not invent a cause, retry time, or completion status to make a message
sound helpful. Offer retry only when appropriate for the operation and known
state.

## Upstream Viewer Version Failure

This named exception applies only to the viewer version-failure card.
The published `mokly-viewer-namespace.md` contract gives every host one
headline for a version failure: **This catalogue needs a compatible viewer**.
The card uses that exact headline, with no supporting sentence, and one
**Reload** action. Do not reword the headline to suit the rules
above. Keep `ViewerError.details` in a closed secondary **Details**
disclosure, as [Viewer host](./viewer-host.md#version-failure) specifies.
No other error inherits this exception.

## Examples

For a publication that could not be processed where retrying is appropriate:

- Avoid: **Your catalogue was not published** / "The upload did not pass
  validation, so the branch still shows the previous publication. Try
  publishing again from CI in a moment."
- Prefer, in the product: **Unable to publish this branch** / "Ask a
  project admin to publish again." A reviewer cannot re-run CI; the admin
  or developer can.
- Prefer, in the check run details and CLI output: "Unable to publish:
  `static/mokly-generated/app/home/index.desktop.html` is listed in the
  artifact inventory but missing from the upload. Run `mokly publish`
  again." The developer needs the path and the command.

Other examples:

- Success: "Approved" instead of "This publication has been successfully
  approved and the pull request check has been updated."
- Check summary: "3 screens changed, 1 added" with links, not a paragraph
  about how Mokly compares branches.
- Empty state: "No publications yet" with a **Set up publishing** action,
  without a paragraph explaining what a publication is.
- Helper text: omit "Enter a name for the project" under a **Project name**
  label.
- Useful detail to keep: "Approval is from an earlier version. Review the
  changes before approving again." The staleness changes the safe next
  action.
