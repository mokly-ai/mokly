//! Candidate starts keep the same session, admission, expiry and authority rules.

use chrono::Duration;
use mkc_domain::values::Role;
use mkc_store_interface::github_identity::GitHubIdentitiesMock;
use mkc_store_interface::github_state::FlowPurpose;
use mkc_store_interface::member::MembersMock;
use mkc_store_interface::rate_limit::RateLimitsMock;
use mkc_store_interface::session::SessionsMock;
use unimock::{MockFn, Unimock, matching};

use crate::error::ApiError;
use crate::github::service::GitHubIntegration;

use super::support::{WORKSPACE, identity, member, now, pure, service};

#[test]
fn candidate_start_persists_the_candidate_before_returning_oauth_authorization() {
    let actor = identity();
    let service = service(Unimock::new((
        SessionsMock::session
            .some_call(matching!(_))
            .returns(Ok(Some(actor.session.clone()))),
        MembersMock::members
            .some_call(matching!(&WORKSPACE))
            .returns(Ok(vec![member(Role::Admin)])),
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
                assert_eq!(flow.installation_id, Some(2));
                assert_eq!(flow.organization_id, Some(WORKSPACE));
                assert_eq!(flow.user_id, Some(identity().user.id));
                assert_eq!(flow.session_hash, Some(identity().session.token_hash));
                assert_eq!(flow.expires_at, now() + Duration::minutes(10));
                assert_eq!(flow.return_to, "/install?installationId=2");
                assert!(flow.used_at.is_none());
                Ok(())
            }),
    )));
    let connection = service
        .start(
            Some(&actor),
            FlowPurpose::Install,
            Some(WORKSPACE),
            Some(2),
            Some("/install?installationId=2"),
            "peer",
        )
        .unwrap();
    assert!(
        connection
            .authorize_url
            .starts_with("https://github.com/login/oauth/authorize?")
    );
    assert!(
        connection
            .authorize_url
            .contains("code_challenge_method=S256")
    );
}

#[test]
fn candidate_start_rejects_nonpositive_ids_before_persistence() {
    for id in [-1, 0] {
        assert!(matches!(
            pure().start(
                Some(&identity()),
                FlowPurpose::Install,
                Some(WORKSPACE),
                Some(id),
                None,
                "peer"
            ),
            Err(ApiError::ValidationFailed)
        ));
    }
}

#[test]
fn candidate_start_requires_a_current_administrator_session() {
    let actor = identity();
    let service = service(Unimock::new((
        SessionsMock::session
            .some_call(matching!(_))
            .returns(Ok(Some(actor.session.clone()))),
        MembersMock::members
            .some_call(matching!(&WORKSPACE))
            .returns(Ok(vec![member(Role::Member)])),
    )));
    assert!(matches!(
        service.start(
            Some(&actor),
            FlowPurpose::Install,
            Some(WORKSPACE),
            Some(2),
            None,
            "peer"
        ),
        Err(ApiError::PermissionDenied)
    ));
}
