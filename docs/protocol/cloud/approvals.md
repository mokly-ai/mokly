# Publication Approvals

Approvals are outside the initial scope, with
[Screen comments](./screen-comments.md): this contract is the draft for the
review phase, and its API routes answer 503.

Approval records a reviewer's decision on an immutable publication. It is
separate from resolving a thread and never implies that every thread is resolved.
See [Comments](./screen-comments.md), [Viewer](./viewer.md), and
[API definitions](../../api/openapi.json).

## Eligibility And Identity

Authenticated project reviewers, members and admins may approve a ready,
PR-linked publication while the PR is open. Standalone publications support
comments; the approval action explains that selecting a pull request enables
approval. Public readers sign in and obtain project access before reviewing.
PR authors may comment on their own work but do not approve their own pull
requests. The server
returns `canApprove` and a typed reason; UI never infers permission from labels.

Each approval stores reviewer ID, publication/head SHA, review ID, time,
optional plain-text summary, state, and GitHub delivery details. Submission
requires the exact publication and expected review head; a changed head returns
409 and offers View latest without discarding a draft summary. One effective
decision per reviewer/head is idempotent; duplicate requests do not create
duplicate GitHub reviews. Withdrawal records a new audit event, never erases
the earlier decision. Closed/merged reviews are read-only.

GitHub-connected reviewers approve as themselves through their authorized user
token when GitHub allows that review. Other reviewers approve inside Mokly;
the App reflects their decision in the check summary and a linked bot comment.
These two identities are explicit in audit details. A saved cloud decision
remains saved if GitHub delivery fails; “Syncing to GitHub” / “Sync failed” are
secondary states, with retry of the same decision rather than resubmission.
Never label a pending or failed remote write as a GitHub approval.

## Staleness

A new ready head with non-empty material Changes (added, changed or removed
screens) marks effective earlier approvals stale. Compare the new publication
to the publication covered by that approval, not merely to the PR base, so a
later edit cannot reuse an older unrelated decision. Stale means “Approval is
from an earlier version” with “Review latest”; preserve the reviewer/time and
original link. Approving the latest records a new decision.

If that comparison is definitively empty, an existing decision remains effective
in Mokly and an explicit carry-forward audit event records the old and new
publication IDs. It does not create a GitHub review falsely attributed to the
new head. If comparison is unavailable, effectiveness is `unverified`; retain
the decision as history and show “Checking changes” rather than Approved.
Approval requirements remain unsatisfied until evidence or a new explicit
decision establishes effectiveness. Failed/unready uploads never supersede the
currently ready review head.

## Optional Required Approval

`requireApproval` is a project setting, default `false`, changeable only by
admins with an audit event. It asks for at least one effective approval from
a reviewer other than the PR author; it is not an invented multi-stage workflow.
When enabled on an open PR with non-empty Changes and no qualifying approval,
the Mokly check has `action_required` with Review changes. A ready publication
with qualifying approval succeeds. Definitively empty Changes does not require
a new approval. Missing comparison produces a neutral “Changes unavailable”
result, never a success claim. Invalid ingest still fails independently.

When disabled, approval status remains informative and does not gate the check.
The publication and check integrity rules of
[Publication ingest](./publication-ingest.md) and
[Changes check](./changes-check.md) take precedence over approval display. The
app never claims that its optional gate configures GitHub branch protection;
administrators choose required checks in GitHub separately. Removing access or
withdrawing an approval invalidates its effectiveness and recomputes the gate.
GitHub-native review policy is not overridden by a cloud decision.

## Presentation And Audit

The decision follows the discussion, separated by a hairline, in the same
document-width column. The viewer's action is “Approve”; it sits beside
Share above the stage. Confirmation names the PR and selected
publication; the optional summary is a labelled multi-line field. After
confirmation show “Approved” with reviewer and time. Required state says
“Ready for your review” and keeps Review changes available. Stale state retains
the earlier decision with its warning and a View latest action. Empty means no
eligible PR/decision; loading uses skeletons; submission failure retains the
summary and offers Retry. No automatic approval on page open, comment
submission or share. Buttons, the summary field, avatars and the single dotted
status badge are the [shared controls](./shared-controls.md) through the shared
control theme. Approval is never a color-only signal.

Every review surface, mockup or live, draws one approval action composition
from the same inputs: the actor, the PR author and state, project access,
publication readiness and the explicit `canApprove` result with its reason.
The PR author never approves their own pull request.

Audit events are append-only: submitted, withdrawn, made-stale, carried-forward,
access-invalidated, sync-queued, sync-succeeded, sync-failed, and policy-changed.
Each has actor (user/App/system), timestamp, original/target publication when
applicable, and correlation ID. Audit details expose delivery identity and
provider link without credentials. Role/access changes and GitHub webhook
reviews are validated against the same publication/head; unrelated remote
reviews are not silently imported as Mokly approvals.
