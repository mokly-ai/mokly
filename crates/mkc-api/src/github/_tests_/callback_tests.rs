//! OAuth state consumption order, email evidence and single-use session issuance.

use std::sync::Arc;

use mkc_auth::runtime::hash;
use mkc_github_interface::credentials::Secret;
use mkc_github_interface::identity::{Email, IdentitiesMock};
use mkc_store_interface::github_identity::GitHubIdentitiesMock;
use mkc_store_interface::github_state::FlowPurpose;
use mkc_store_interface::integration::IntegrationsMock;
use mkc_store_interface::session::SessionsMock;
use mkc_store_interface::user::UsersMock;
use unimock::{MockFn, Unimock, matching};

use crate::error::ApiError;
use crate::github::input::Callback;
use crate::github::service::GitHubIntegration;
use crate::github_error::GitHubError;

use super::support::{USER, flow, github_user, identity, now, service, user};

fn input() -> Callback {
    Callback {
        code: "code".into(),
        state: "a".repeat(64),
        code_verifier: "b".repeat(64),
    }
}

#[test]
fn verified_callback_reuses_magic_link_identity_and_issues_a_hashed_session() {
    let queries = Unimock::new((
        GitHubIdentitiesMock::github_oauth_flow
            .some_call(matching!(_))
            .returns(Ok(Some(flow()))),
        GitHubIdentitiesMock::save_github_oauth_flow
            .some_call(matching!(_))
            .answers(&|_, flow| {
                assert_eq!(flow.used_at, Some(now()));
                Ok(())
            }),
        GitHubIdentitiesMock::github_identity
            .some_call(matching!(1))
            .returns(Ok(None)),
        UsersMock::find_user
            .some_call(matching!("octocat@example.com"))
            .returns(Ok(Some(user()))),
        GitHubIdentitiesMock::user_github_identity
            .some_call(matching!(&USER))
            .returns(Ok(None)),
        GitHubIdentitiesMock::save_github_identity
            .some_call(matching!(_))
            .returns(Ok(())),
        IntegrationsMock::save_integration
            .some_call(matching!(_, _, _))
            .returns(Ok(())),
        SessionsMock::insert_session
            .some_call(matching!(_))
            .answers(&|_, session| {
                assert_eq!(session.user_id, USER);
                assert_eq!(session.token_hash, hash(&"c".repeat(64)));
                assert_ne!(session.token_hash, "c".repeat(64));
                Ok(())
            }),
    ));
    let mut service = service(queries);
    service.identities = Arc::new(Unimock::new((
        IdentitiesMock::exchange
            .some_call(matching!(_))
            .answers(&|_, input| {
                assert_eq!(input.verifier, "b".repeat(64));
                Ok(Secret::new("token".into()))
            }),
        IdentitiesMock::user
            .some_call(matching!(_))
            .returns(Ok(github_user())),
        IdentitiesMock::emails
            .some_call(matching!(_))
            .returns(Ok(vec![Email {
                email: " OCTOCAT@example.com ".into(),
                primary: true,
                verified: true,
            }])),
    )));
    let result = service.callback(None, input(), None, None).unwrap();
    assert_eq!(result.session.identity.user.id, USER);
    assert_eq!(result.return_to, flow().return_to);
}

#[test]
fn unverified_or_nonprimary_email_never_reaches_identity_or_session_queries() {
    for (primary, verified) in [(true, false), (false, true), (false, false)] {
        let mut service = service(Unimock::new((
            GitHubIdentitiesMock::github_oauth_flow
                .some_call(matching!(_))
                .returns(Ok(Some(flow()))),
            GitHubIdentitiesMock::save_github_oauth_flow
                .some_call(matching!(_))
                .returns(Ok(())),
        )));
        service.identities = Arc::new(Unimock::new((
            IdentitiesMock::exchange
                .some_call(matching!(_))
                .returns(Ok(Secret::new("token".into()))),
            IdentitiesMock::user
                .some_call(matching!(_))
                .returns(Ok(github_user())),
            IdentitiesMock::emails
                .some_call(matching!(_))
                .returns(Ok(vec![Email {
                    email: "octocat@example.com".into(),
                    primary,
                    verified,
                }])),
        )));
        assert!(matches!(
            service.callback(None, input(), None, None),
            Err(ApiError::GitHub(GitHubError::EmailUnverified))
        ));
    }
}

#[test]
fn consumed_expired_unknown_and_mismatched_states_never_exchange_a_code() {
    let mut used = flow();
    used.used_at = Some(now());
    let mut expired = flow();
    expired.expires_at = now();
    let mut wrong = flow();
    wrong.verifier_hash = hash("other");
    for flow in [None, Some(used), Some(expired), Some(wrong)] {
        let service = service(Unimock::new(
            GitHubIdentitiesMock::github_oauth_flow
                .some_call(matching!(_))
                .returns(Ok(flow)),
        ));
        assert!(matches!(
            service.callback(None, input(), None, None),
            Err(ApiError::GitHub(GitHubError::AuthInvalid))
        ));
    }
}

#[test]
fn a_connect_callback_requires_the_original_live_session_and_csrf() {
    let mut state = flow();
    state.purpose = FlowPurpose::Connect;
    state.user_id = Some(USER);
    state.session_hash = Some(identity().session.token_hash);
    let service = service(Unimock::new((
        GitHubIdentitiesMock::github_oauth_flow
            .some_call(matching!(_))
            .returns(Ok(Some(state))),
        SessionsMock::session
            .some_call(matching!(_))
            .returns(Ok(Some(identity().session))),
    )));
    assert!(matches!(
        service.callback(Some(&identity()), input(), Some("previous"), None),
        Err(ApiError::CsrfRejected)
    ));
}
