//! The admitted client selects only the email landing query.

use std::sync::Arc;

use mkc_email_interface::mail::{Content, Lifetime, MailerMock};
use mkc_domain::client_origins::{AdmittedOrigins, DESKTOP_ORIGIN};
use mkc_store_interface::magic_link::MagicLinksMock;
use mkc_store_interface::rate_limit::RateLimitsMock;
use unimock::{MockFn, Unimock, matching};

use crate::service::Authenticator;

use super::failure_fixture::runtime;
use super::support::service;

#[test]
fn links_keep_the_public_app_origin_and_select_the_client_query() {
    for (origin, expected_path) in [
        ("https://app.example.com", "/auth/email/callback"),
        (DESKTOP_ORIGIN, "/auth/email/callback?client=desktop"),
    ] {
        let queries = Unimock::new((
            RateLimitsMock::rate_limit
                .each_call(matching!(_))
                .answers(&|_, _| Ok(None)),
            RateLimitsMock::insert_rate_limit
                .each_call(matching!(_))
                .answers(&|_, _| Ok(())),
            MagicLinksMock::insert_magic_link
                .next_call(matching!(_))
                .returns(Ok(())),
        ));
        let mailer = Unimock::new(
            MailerMock::send
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, message| {
                    assert_eq!(
                        message.content.link(),
                        format!(
                            "https://app.example.com{expected_path}#token={}",
                            "a".repeat(64)
                        )
                    );
                    assert_eq!(message.recipient, "person@example.com");
                    assert!(matches!(
                        message.content,
                        Content::SignIn {
                            valid_for: Lifetime::Minutes(15),
                            ..
                        }
                    ));
                    Ok(())
                })),
        );
        let mut auth = service(queries, Arc::new(mailer), runtime());
        auth.origins = AdmittedOrigins::new("https://app.example.com".to_owned(), true);
        let client = auth.origin(Some(origin)).unwrap();
        auth.issue("person@example.com", None, "127.0.0.1", client)
            .unwrap();
    }
}
