# mkc-email-interface

The synchronous single-recipient mail boundary of Mokly Cloud. `mkc-auth` and
the platform service in `mkc-api` send sign-in links and invitations through
its `Mailer` trait, and `mkc-email-postmark` implements the trait for Postmark and
for development logging. Depend on it from a service that sends a product
action email or from an adapter that delivers one; neither side depends on the
other.

## Responsibilities

Own the `Mailer` trait, the typed message content and the delivery error
contract.

## What This Crate Does

A `Message` carries one validated recipient and either `Content::SignIn` or
`Content::Invitation`. Each variant holds the complete action link and a
`Lifetime` that the issuing service also stores, so the copy and the stored
expiry cannot disagree; the invitation also carries the stored organization
and inviter names. A service sends the message after its database transaction
commits and never renders a body: the adapter maps the typed content to the
provider's template. A sign-in message contains a credential, so `Message` and
`Content` have no `Debug` representation and only the development log mailer
in `mkc-email-postmark` prints the link. A delivery failure is `Error::Internal`
with the provider diagnostics preserved. The trait ships a unimock API,
`MailerMock`, for service unit tests.

## Quick Start

```rust
use mkc_email_interface::mail::{Content, Lifetime, Mailer, Message, Result};

/// Send the sign-in link after the issuing transaction has committed.
fn send_sign_in(mailer: &dyn Mailer, recipient: String, link: String) -> Result<()> {
    mailer.send(&Message {
        recipient,
        content: Content::SignIn {
            link,
            valid_for: Lifetime::Minutes(15),
        },
    })
}
```

## Development

```sh
cargo test -p mkc-email-interface
cargo clippy -p mkc-email-interface --all-targets -- -D warnings
```

Call `Mailer::send` from a blocking worker, never on the async reactor. The
trait is synchronous and does not retry an ambiguous send; the caller decides
whether a failed delivery is reported or repeated.

### Key Code

- [mail.rs](./src/mail.rs) — `Mailer`, the trait an adapter implements and a service calls; `Message`, `Content::SignIn { link, valid_for }` and `Content::Invitation`, the typed content a service sends after its transaction commits; `Lifetime::Minutes` and `Lifetime::Days`, whose `phrase()` formats the expiry the copy shows. `Message` and `Content` are `Clone` and deliberately not `Debug`, so a link cannot reach a log.

### Related Docs

- [Email](../../docs/protocol/cloud/email.md)
- [Authentication](../../docs/protocol/cloud/auth-sessions.md)
- [Platform model](../../docs/protocol/cloud/platform-model.md)
- [Architecture](../../docs/architecture/cloud.md) — the components, their boundaries, and the data flows this crate takes part in.
