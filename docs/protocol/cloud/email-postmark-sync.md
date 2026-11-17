# Postmark Template Synchronization

The two transactional email definitions in the mockup catalogue are rendered
to the six committed files in `crates/mkc-email-templates/templates/`. The
repository owns those files; Postmark is a deployed copy. The sign-in and
invitation aliases are `mokly-sign-in` and `mokly-invitation` on each stable
server.

## Source And Verification

`npm run emails:build` renders the standalone HTML document, subject and
plain-text alternative from the same email components as the catalogue.
`npm run emails:check` compares every committed file byte-for-byte and rejects
missing, extra or changed files. `cargo xtask email-templates --check` is
stage 19 of `cargo xtask check`. The HTML and text keep their final newline;
the Postmark `Subject` field omits only the generated subject file's final
newline. The generated files are excluded from Prettier so formatting cannot
change delivery bytes.

## Trusted Deployment

Only `.github/workflows/deploy.yml` on protected `main` can assume the
`mkc-github-postmark` Google service account. The foundation stack gives
that identity Secret Manager `secretAccessor` on exactly
`mkc-main-preview-postmark-token` and `mkc-production-postmark-token`.
The deploy, plan and apply identities do not gain this access. GitHub holds
the service account email as `GCP_POSTMARK_SYNC_SERVICE_ACCOUNT`, not a
Postmark token. Postmark server tokens stay in Secret Manager and are
never written to workflow artifacts or logs.

After each stable environment's infrastructure apply, its sync job verifies
the generated source, reads that environment's token, and synchronizes before
the API rollout. The production job runs only when production promotion is
enabled. A failed sync blocks that environment's rollout and fails the
deployment required gate. There is no PR job with Postmark credentials.
The job runs on every eligible `main` promotion even if email files did not
change, so it also repairs a manual edit in Postmark. It does not delete
unmanaged Postmark templates.

## Comparison And Upload

For each alias, the sync job reads `GET /templates/{alias}` with that
server's token. An HTTP 422 response with Postmark error code 1101 means the
alias is absent and permits create; all other lookup errors fail the job. It
compares `Name`, `Alias`, `Subject`, `HtmlBody`, `TextBody`, standard template
type, absence of a layout and active state. Identical templates cause no
write. A missing or different template is validated through
`POST /templates/validate`, then created with `POST /templates` or updated
with `PUT /templates/{alias}`. A final GET must match the committed values,
including the template type and the absence of a layout. An existing layout
using a managed alias is an error because Postmark cannot change its type.
Create sends the five owned content fields plus `TemplateType: Standard` and
`LayoutTemplate: ""`. Edit sends the same five fields and
`LayoutTemplate: ""`, omitting the create-only `TemplateType` field.

Every request checks both HTTP status and Postmark's application error code.
Validation failures, authorization failures, unexpected responses, rejected
writes and read-back drift fail the job without printing tokens or template
bodies. The job records each alias as `created`, `updated` or `unchanged`.

The stable API sends by `TemplateAlias` through `POST /email/withTemplate`.
Therefore the sync must succeed before each API rollout. Preview APIs use the
log mailer and do not need a Postmark template. The send model and tracking
contract, including HTML versus text substitution syntax, are in
[Hosted delivery](./email.md#hosted-delivery).
Both stable APIs use the public site origin for the logo; the main-preview
action links use its separate app origin.

Related: [Email document](./email.md), [secret setup](../../ops/secrets.md),
[deployment](../../ops/deploy.md), and the
[Postmark Templates API](https://postmarkapp.com/developer/api/templates-api).
