# Public preview sample project

Status: Active. On branch `conductor/preview-sample-project-public`, no pull
request yet. The pull request that completes the work deletes this plan, as
the `plans` skill says.

Every pull request with the `preview` label gets a preview. The preview seed
puts the pull request's mockups into the sample project **Mokly Cloud**
(`mokly-ai/mokly`) of the shared account `preview@mokly.ai`. The seed makes
that project private, and this repository is public, so its preview comment
has no **Open preview** link. A reviewer needs cluster log access, or an
operator, to sign in. The private project also cannot show its Changes,
because the viewer reads comparison files without credentials.

User decision, 2026-11-20: the user chose option D of
`plans/follow-ups/preview-sample-project-needs-log-access.md`, with corrected
text. Part C: the seed finds or creates the sample project, changes it to
`public` when it is private, and then requires `public`. Part D: the success
comment replaces the pattern **Catalogue** line with a real link,
`https://p-{publicationId}.pr-N.preview.{C}/`, built from the seed proof's
`publicationId` after a canonical UUID check. The alternatives were A, keep
the private project and the email sign-in path, B, an operator command that
prints the shared sign-in link, and C alone. C alone fails the goal: the app
sends every signed-out reader of a project route to sign-in, and in previews
every sign-in link goes to the restricted API logs. The catalogue host serves
the standalone viewer at `/` of each publication host, and public
publications and their comparisons load there without a sign-in. So D gives
the signed-out path.

The change does not touch the app, `@mokly/viewer`, the catalogue server, the
API outside the seed, or the workflow. It keeps the **Open preview** rules for
private repositories and the **Sample project** link.

Design calls, 2026-11-20, my calls:

- The seed checks the identity values of the found or created project first.
  Then it changes a private project to public. Then it requires `public` on
  the project that the update returns. Reason: the seed never writes to a
  project whose identity does not match.
- The update sends the stored name, slug, approval setting and version, with
  visibility `public` and no Automatic builds value. Reason: only the
  visibility changes. A public project gets no update.
- The comment reads only `publicationId` from the proof. Reason: the step
  **Require seed evidence** already validates every proof field, and the
  `success` state needs that step.
- The **Catalogue** line of the `success` state is a bare URL, like the
  **App** and **API** lines, so that GitHub links it.
- The task message of 2026-11-20 gives the approach, the scope and the
  steps. I treat it as the approval of this plan, and I do not stop for a
  separate approval.

Contract owners:

- [Preview seed](../docs/protocol/cloud/preview-seed.md).
- [Local preview seed](../docs/protocol/cloud/preview-seed-local.md).
- [Preview scripts](../docs/protocol/cloud/preview-scripts.md).

## Milestone 1: Documentation and protocol

Depends on: none

The docs state that the sample project is public in every preview, that a
successful comment links the publication host, and that a signed-out reader
opens it for the mockups and their Changes.

- [ ] `docs/protocol/cloud/preview-seed.md`: the intro, the last paragraph of
      "Account And Sign-In Link", step 6 of "Seed Steps", "Workflow, Comment
      And Failures", and "Reset". The page stays at or under 250 lines.
- [ ] `docs/protocol/cloud/preview-seed-local.md`: the local sample project
      is public, so Changes load.
- [ ] `docs/protocol/cloud/preview-scripts.md`: the comment's inputs and the
      **Catalogue** line. The page stays at or under 250 lines.
- [ ] `docs/ops/preview.md`: step 3 of "Review A Labelled PR" and the comment
      paragraph.
- [ ] `docs/development/cloud.md`, section "Local Preview Stack",
      `docs/ops/repository-cutover.md` and `infra/README.md`: correct the
      text about the private sample project and the Changes overlay.

## Milestone 2: Seed makes the sample project public

Depends on: 1

- [ ] Change a private sample project to public, and require `public`.
- [ ] Service tests through `SeedService::run`: a created private project
      becomes public, a found private project becomes public, and a found
      public project gets no update.
- [ ] The command tests require a public seeded project.

## Milestone 3: Comment links the publication

Depends on: 1

- [ ] In the `success` state, build the **Catalogue** link from the proof's
      `publicationId` after `canonical_uuid`. When the proof cannot be read
      or the ID is not canonical, keep the pattern line and print a warning
      to stderr. Keep the pattern line in every other state.
- [ ] Tests in `infra/tests/test_preview_comment.py` for the link, the
      fallback and the other states.

## Milestone 4: Follow-up items

Depends on: 2, 3

- [ ] `plans/follow-ups/seed-kept-rules-lost-tests.md`: use a field that
      still mismatches as its example, and update its line references.
- [ ] `plans/follow-ups/preview-proof-runs-not-recorded.md`: add the
      **Catalogue** link to the comment links.
- [ ] Delete `plans/follow-ups/preview-sample-project-needs-log-access.md`.

## Milestone 5: Verification, commit, review, and pull request

Depends on: 1, 2, 3, 4

- [ ] Run the targeted tests, the early check and the complete gate.
- [ ] Seed the local preview stack. Open the publication host signed out,
      and confirm that Browse and Changes load. Save the screenshots under
      `.context/preview-sample-project-public/`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Open the pull request into `main`.
- [ ] Add the `preview` label to the pull request once. Take the
      `publicationId` from the run's `preview-evidence-pr-N` artifact. Open
      the publication host signed out, and confirm that Browse and Changes
      load.
- [ ] Review the complete diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record follow-up
      items under `plans/follow-ups/` for the rest, re-review once, and
      report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Update the pull request description. It gives the decision and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds or deletes.
