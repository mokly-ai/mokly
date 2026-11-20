# mkc-email-postmark

Postmark and development mail delivery for Mokly Cloud. The crate implements
the `Mailer` trait of `mkc-email-interface` twice: `PostmarkMailer` sends through
Postmark's hosted templates, and `LogMailer` writes the action link to the log
for development and previews. Construct one of them at the API composition
root in `mkc-api` from the validated `MKC_MAILER` settings and hand it to the
services as `Arc<dyn Mailer>`; the services never see this crate.

## Responsibilities

Map sign-in and invitation messages to the documented Postmark hosted-template
request, and provide the explicit development mailer.

## What This Crate Does

`PostmarkMailer` sends `POST /email/withTemplate` with the template alias from
`mkc-email-templates` and a typed model; Postmark renders the subject, the
HTML and the plain text from the template synchronized to its server, and the
validated `MKC_SITE_ORIGIN` supplies the published logo URL. Requests disable
CSS inlining, link and open tracking, redirects and automatic retries, and
time out after ten seconds. A non-2xx status or a nonzero Postmark error code
fails with the provider diagnostics preserved in `Error::Internal`.
`LogMailer` emits one `mkc_dev_mail` tracing event with the recipient and the
link; it needs no SMTP server.

## Quick Start

```rust
use std::sync::Arc;

use mkc_email_interface::mail::{Mailer, Result};
use mkc_email_postmark::delivery::{LogMailer, PostmarkMailer};
use mkc_email_postmark::transport::{PostmarkHttpFactory, TransportFactory};

/// Production delivery through Postmark's hosted templates.
fn postmark(from: String, server_token: String, site_origin: String) -> Result<Arc<dyn Mailer>> {
    Ok(Arc::new(PostmarkMailer {
        from,
        site_origin,
        transport: PostmarkHttpFactory.build(
            "https://api.postmarkapp.com/email/withTemplate".to_owned(),
            server_token,
        )?,
    }))
}

/// Development and preview delivery: the action link goes to the log, not to a mailbox.
fn log() -> Arc<dyn Mailer> {
    Arc::new(LogMailer)
}
```

## Development

```sh
cargo test -p mkc-email-postmark
cargo clippy -p mkc-email-postmark --all-targets -- -D warnings
```

`tests/recorded_http_tests.rs` drives the real transport against a loopback
HTTP double with sanitized fixtures of the documented success and rejection
envelopes, so the suite needs no Postmark account. The fixture source is the
[Postmark Templates API](https://postmarkapp.com/developer/api/templates-api).

### Key Code

- [delivery.rs](./src/delivery.rs) — `PostmarkMailer`, the hosted-template send with CSS inlining and tracking off, and `LogMailer`, the development mailer that emits one `mkc_dev_mail` tracing event with only the recipient and the link.
- [transport.rs](./src/transport.rs) — `Transport`, `TransportFactory` and `PostmarkHttpFactory`, the `POST /email/withTemplate` request with its finite timeout, and `Email`, the request body in Postmark's field spelling.
- [model.rs](./src/model.rs) — `SignInModel` and `InvitationModel`, the typed template models whose fields are the closed placeholder sets of the committed templates.

### Related Docs

- [Email](../../docs/protocol/cloud/email.md)
- [Postmark template synchronization](../../docs/protocol/cloud/email-postmark-sync.md)
- [Authentication](../../docs/protocol/cloud/auth-sessions.md)
- [Platform model](../../docs/protocol/cloud/platform-model.md)
- [Architecture](../../docs/architecture/cloud.md) — the components, their boundaries, and the data flows this crate takes part in.
