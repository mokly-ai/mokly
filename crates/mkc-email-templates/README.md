# mkc-email-templates

The committed sign-in and invitation email templates of Mokly Cloud, generated
from the email definitions in the mockup catalogue. The crate embeds the six
rendered files and exposes them byte-exact to Rust callers. `mkc-email-postmark`
reads the template aliases from it, and the trusted deployment workflow
synchronizes the files to the stable Postmark servers. Depend on it when a
Rust caller needs the exact reviewed template source or a template alias.

## Responsibilities

- Own the generated HTML, plain text and subject for each transactional email.
- Expose the byte-exact committed artifacts and the stable template aliases
  to Rust callers.

## What This Crate Does

`templates::get` returns the three source parts of `Kind::SignIn` or
`Kind::Invitation` as a `Template`. `Kind::alias` supplies the stable alias
(`mokly-sign-in` or `mokly-invitation`) that the sender and the sync job
share. The subject file ends with a newline; the Postmark sync removes only
that final newline when it sets `Subject`. HTML uses escaped `{{name}}`
substitutions, while the subject and plain text use unescaped `{{{name}}}` so
names and links stay readable.

## Quick Start

```rust
use mkc_email_templates::templates::{Kind, get};

let template = get(Kind::SignIn);
assert!(template.subject.starts_with("Sign in"));
assert_eq!(Kind::SignIn.alias(), "mokly-sign-in");
```

## Development

Regenerate the six files under `templates/` after a change to the email
definitions in the mockup catalogue, then check that the committed files match
the generator output:

```sh
npm run emails:build
npm run emails:check
cargo test -p mkc-email-templates
node --test infra/tests/postmark_templates.test.mjs
```

The generator is [emails.ts](../../apps/mockups/scripts/emails.ts) in the
`apps/mockups` npm workspace, and
[sync-postmark-templates.mjs](../../infra/scripts/sync-postmark-templates.mjs)
compares the committed files with each stable Postmark server during a
deployment. Never edit the generated files by hand.

### Key Code

- [templates.rs](./src/templates.rs) — `Kind` with `Kind::alias`, `Template` and `get`, the embedded byte-exact sources of the two transactional emails.
- [templates/](./templates/) — the six generated files: `sign-in.html`, `sign-in.txt` and `sign-in.subject.txt`, and the matching `invitation` triple.

### Related Docs

- [Email](../../docs/protocol/cloud/email.md)
- [Email authoring and checks](../../docs/protocol/cloud/email-authoring.md)
- [Postmark template synchronization](../../docs/protocol/cloud/email-postmark-sync.md)
- [Secret and identity operations](../../docs/ops/secrets.md)
- [Architecture](../../docs/architecture/cloud.md) — the components, their boundaries, and the data flows this crate takes part in.
