//! PKCE setup, safe return destinations and OAuth flow admission.

use mkc_domain::values::Role;
use mkc_github::security::pkce_challenge;
use mkc_store_interface::github_identity::GitHubIdentitiesMock;
use mkc_store_interface::github_state::FlowPurpose;
use mkc_store_interface::member::MembersMock;
use mkc_store_interface::rate_limit::{RateLimit, RateLimitsMock};
use mkc_store_interface::session::SessionsMock;
use rpc_error::{RpcError, Severity};
use unimock::{MockFn, Unimock, matching};
use url::Url;

use crate::error::ApiError;
use crate::github::service::GitHubIntegration;

use super::support::{RETURN_TO, WORKSPACE, flow, identity, member, now, service};

#[test]
fn start_flow_stores_hashes_and_preserves_only_safe_app_navigation() {
    let service = service(Unimock::new((
        RateLimitsMock::rate_limit
            .some_call(matching!(_))
            .returns(Ok(None)),
        RateLimitsMock::insert_rate_limit
            .some_call(matching!(_))
            .returns(Ok(())),
        GitHubIdentitiesMock::github_oauth_flow
            .some_call(matching!(_))
            .returns(Ok(None)),
        GitHubIdentitiesMock::save_github_oauth_flow
            .some_call(matching!(_))
            .answers(&|_, flow| {
                assert_eq!(flow.return_to, RETURN_TO);
                assert_ne!(flow.state_hash, "c".repeat(64));
                assert_ne!(flow.verifier_hash, "c".repeat(64));
                assert!(flow.user_id.is_none());
                Ok(())
            }),
    )));
    let connection = service
        .start(
            None,
            FlowPurpose::SignIn,
            None,
            None,
            Some(RETURN_TO),
            "127.0.0.1",
        )
        .unwrap();
    let url = Url::parse(&connection.authorize_url).unwrap();
    let params: Vec<_> = url.query_pairs().collect();
    assert!(
        params
            .iter()
            .any(|(key, value)| key == "code_challenge_method" && value == "S256")
    );
    assert!(params.iter().any(|(key, value)| key == "code_challenge"
        && value == &pkce_challenge(&connection.code_verifier)));
    assert!(params.iter().any(|(key, value)| key == "redirect_uri"
        && value == "https://app.example.com/auth/github/callback"));
    assert!(!connection.authorize_url.contains("code_verifier"));
}

#[test]
fn rejected_return_destination_falls_back_before_flow_persistence() {
    let service = service(Unimock::new((
        RateLimitsMock::rate_limit
            .some_call(matching!(_))
            .returns(Ok(None)),
        RateLimitsMock::insert_rate_limit
            .some_call(matching!(_))
            .returns(Ok(())),
        GitHubIdentitiesMock::github_oauth_flow
            .some_call(matching!(_))
            .returns(Ok(None)),
        GitHubIdentitiesMock::save_github_oauth_flow
            .some_call(matching!(_))
            .answers(&|_, flow| {
                assert_eq!(flow.return_to, "/dashboard");
                Ok(())
            }),
    )));
    service
        .start(
            None,
            FlowPurpose::SignIn,
            None,
            None,
            Some("https://evil.invalid/steal"),
            "127.0.0.1",
        )
        .unwrap();
}

#[test]
fn oauth_admission_uses_the_persisted_peer_window() {
    let service = service(Unimock::new(
        RateLimitsMock::rate_limit
            .some_call(matching!(_))
            .returns(Ok(Some(RateLimit {
                key: "hashed".into(),
                count: 20,
                resets_at: now() + chrono::Duration::seconds(30),
            }))),
    ));
    assert!(matches!(
        service.start(None, FlowPurpose::SignIn, None, None, None, "127.0.0.1"),
        Err(ApiError::RateLimited(30))
    ));
}

#[test]
fn generated_state_collisions_are_internal_for_every_flow_purpose() {
    for purpose in [
        FlowPurpose::SignIn,
        FlowPurpose::Connect,
        FlowPurpose::Install,
    ] {
        let actor = identity();
        let admission = (
            RateLimitsMock::rate_limit
                .some_call(matching!(_))
                .returns(Ok(None)),
            RateLimitsMock::insert_rate_limit
                .some_call(matching!(_))
                .returns(Ok(())),
            GitHubIdentitiesMock::github_oauth_flow
                .some_call(matching!(_))
                .returns(Ok(Some(flow()))),
        );
        let session = SessionsMock::session
            .some_call(matching!(_))
            .returns(Ok(Some(actor.session.clone())));
        let admin = MembersMock::members
            .some_call(matching!(&WORKSPACE))
            .returns(Ok(vec![member(Role::Owner)]));
        let queries = match purpose {
            FlowPurpose::SignIn => Unimock::new(admission),
            FlowPurpose::Connect => Unimock::new((admission, session)),
            FlowPurpose::Install => Unimock::new((admission, session, admin)),
        };
        let service = service(queries);
        let result = service.start(
            (purpose != FlowPurpose::SignIn).then_some(&actor),
            purpose,
            (purpose == FlowPurpose::Install).then_some(WORKSPACE),
            None,
            None,
            "127.0.0.1",
        );
        let error = match result {
            Err(error) => error,
            Ok(_) => panic!("colliding state was issued"),
        };
        assert!(matches!(error, ApiError::Internal(_)), "{error:?}");
        let rpc = RpcError::from(error);
        assert_eq!(rpc.reason(), "internal-error");
        assert_eq!(rpc.status_code_u16(), 500);
        assert_eq!(rpc.severity(), Severity::Error);
    }
}
